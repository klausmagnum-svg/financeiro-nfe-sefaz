import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteDriveFile, getDriveRootFolderId, uploadDriveFile } from "@/app/lib/googleDriveServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maxFileSize = 25 * 1024 * 1024;

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
  if (!clients) {
    return {
      error: NextResponse.json(
        { error: "Supabase Auth do servidor nao esta configurado. Configure SUPABASE_SERVICE_ROLE_KEY no .env.local." },
        { status: 500 }
      ),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "Sessao nao encontrada. Entre novamente no sistema." }, { status: 401 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await clients.authClient.auth.getUser(token);

  if (authError || !user?.email) {
    return { error: NextResponse.json({ error: "Sessao invalida. Entre novamente no sistema." }, { status: 401 }) };
  }

  const { data: usuario, error: usuarioError } = await clients.adminClient
    .from("usuarios_sistema")
    .select("id,nome,email,perfil,status")
    .ilike("email", user.email)
    .maybeSingle();

  if (usuarioError) {
    return { error: NextResponse.json({ error: `Nao foi possivel validar o usuario: ${usuarioError.message}` }, { status: 500 }) };
  }

  if (!usuario || (usuario.status ?? "").toLowerCase() === "inativo") {
    return { error: NextResponse.json({ error: "Usuario nao encontrado ou inativo no Cadastro / Usuarios." }, { status: 403 }) };
  }

  return { adminClient: clients.adminClient, usuario };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Informe o cliente para listar anexos." }, { status: 400 });
  }

  const { data, error } = await auth.adminClient
    .from("cliente_anexos")
    .select("id,cliente_id,nome,mime_type,tamanho,drive_file_id,drive_web_view_link,categoria,criado_por,criado_em")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Nao foi possivel listar anexos: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ anexos: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const clienteId = String(formData.get("clienteId") ?? "");
  const categoria = String(formData.get("categoria") ?? "Documento") || "Documento";
  const file = formData.get("file");

  if (!clienteId || !(file instanceof File)) {
    return NextResponse.json({ error: "Informe o cliente e o arquivo para anexar." }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "Arquivo acima do limite de 25 MB." }, { status: 400 });
  }

  const { data: cliente, error: clienteError } = await auth.adminClient
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle();

  if (clienteError || !cliente) {
    return NextResponse.json({ error: clienteError?.message || "Cliente nao encontrado." }, { status: 404 });
  }

  const driveFile = await uploadDriveFile(file, getDriveRootFolderId());
  const { data, error } = await auth.adminClient
    .from("cliente_anexos")
    .insert({
      cliente_id: clienteId,
      nome: file.name,
      mime_type: file.type || driveFile.mimeType || null,
      tamanho: file.size,
      drive_file_id: driveFile.id,
      drive_web_view_link: driveFile.webViewLink || null,
      categoria,
      criado_por: auth.usuario.nome || auth.usuario.email,
    })
    .select("id,cliente_id,nome,mime_type,tamanho,drive_file_id,drive_web_view_link,categoria,criado_por,criado_em")
    .single();

  if (error) {
    await deleteDriveFile(driveFile.id).catch(() => undefined);
    return NextResponse.json({ error: `Arquivo enviado ao Drive, mas nao foi possivel registrar no ERP: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ anexo: data });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Informe o anexo para excluir." }, { status: 400 });
  }

  const { data: anexo, error: anexoError } = await auth.adminClient
    .from("cliente_anexos")
    .select("id,drive_file_id")
    .eq("id", id)
    .maybeSingle();

  if (anexoError || !anexo) {
    return NextResponse.json({ error: anexoError?.message || "Anexo nao encontrado." }, { status: 404 });
  }

  await deleteDriveFile(anexo.drive_file_id);
  const { error } = await auth.adminClient.from("cliente_anexos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Arquivo excluido do Drive, mas nao foi possivel remover do ERP: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
