import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClientDocumentFolderStructure } from "@/app/lib/googleDriveServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function createClients() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    adminClient: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

async function authorize(request: Request) {
  const clients = createClients();
  if (!clients) return { error: NextResponse.json({ error: "Supabase nao configurado" }, { status: 500 }) };

  const token = getBearerToken(request);
  if (!token) return { error: NextResponse.json({ error: "Token nao fornecido" }, { status: 401 }) };

  const { data: { user }, error: authError } = await clients.authClient.auth.getUser(token);
  if (authError || !user?.email) return { error: NextResponse.json({ error: "Token invalido" }, { status: 401 }) };

  const { data: usuario, error: usuarioError } = await clients.adminClient
    .from("usuarios_sistema")
    .select("*")
    .ilike("email", user.email)
    .maybeSingle();

  if (usuarioError || !usuario) return { error: NextResponse.json({ error: "Usuario nao encontrado" }, { status: 401 }) };

  return {
    adminClient: clients.adminClient,
    usuario,
  };
}

function canSincronizarNFSe(usuario: any) {
  const perfil = (usuario.perfil ?? "").toLowerCase();
  if (["administrador", "gestor"].includes(perfil)) return true;
  return Boolean(usuario.permissoes?.["documentos_fiscais.sincronizar"]);
}

export async function POST(request: Request) {
  const authResult = await authorize(request);
  if ("error" in authResult) return authResult.error;

  const { adminClient, usuario } = authResult;

  if (!canSincronizarNFSe(usuario)) {
    return NextResponse.json({ error: "Permissao insuficiente para sincronizar NFS-es" }, { status: 403 });
  }

  let { clienteId, certificadoId, tipo_documento } = await request.json();

  if (!clienteId || !certificadoId) {
    return NextResponse.json({ error: "clienteId e certificadoId sao obrigatorios" }, { status: 400 });
  }

  tipo_documento = tipo_documento || "NFSe";

  try {
    const { data: cliente, error: clienteError } = await adminClient
      .from("clientes")
      .select("id,razao_social,identificacao")
      .eq("id", clienteId)
      .maybeSingle();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: `Cliente nao encontrado: ${clienteError?.message || "ID invalido"}` }, { status: 404 });
    }

    const { data: certificado, error: certError } = await adminClient
      .from("cliente_certificados")
      .select("*")
      .eq("id", certificadoId)
      .eq("cliente_id", clienteId)
      .maybeSingle();

    if (certError || !certificado) {
      return NextResponse.json({ error: `Certificado nao encontrado: ${certError?.message || "ID invalido"}` }, { status: 404 });
    }

    if (certificado.data_validade && new Date(certificado.data_validade) < new Date()) {
      return NextResponse.json({ error: "Certificado vencido" }, { status: 400 });
    }

    if (!certificado.ativo) {
      return NextResponse.json({ error: "Certificado inativo" }, { status: 400 });
    }

    const { data: sincSync, error: syncInsertError } = await adminClient
      .from("documentos_fiscais_sincronizacoes")
      .insert({
        cliente_id: clienteId,
        certificado_id: certificadoId,
        tipo_documento,
        status: "Pendente",
        data_inicio: new Date().toISOString(),
      })
      .select()
      .single();

    if (syncInsertError || !sincSync) {
      return NextResponse.json({ error: "Erro ao criar registro de sincronizacao" }, { status: 500 });
    }

    const folderStructure = await createClientDocumentFolderStructure(
      cliente.razao_social,
      cliente.identificacao
    );

    if (!folderStructure.success) {
      throw new Error(`Erro ao criar pastas: ${folderStructure.error}`);
    }

    // Atualizar registro de sincronização
    await adminClient
      .from("documentos_fiscais_sincronizacoes")
      .update({
        status: "Pendente",
        pasta_criada: true,
        quantidade_encontrada: 0,
        quantidade_importada: 0,
        quantidade_erro: 0,
        mensagem: "Pasta criada com sucesso. Sincronização pendente.",
      })
      .eq("id", sincSync.id);

    return NextResponse.json({
      sucesso: true,
      mensagem: "Estrutura de pastas criada com sucesso no Google Drive. Integração com Sefaz em desenvolvimento.",
      sincronizacao: {
        id: sincSync.id,
        status: "Pendente",
        pasta_criada: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
