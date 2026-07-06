import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClientDocumentFolderStructure, uploadNFSeXmlToDrive } from "@/app/lib/googleDriveServer";
import { loginAndDownloadNFSes, extractNFSeDataFromXml } from "@/app/lib/nfsePortalIntegration";
import { decryptSecret } from "@/app/lib/certificateCrypto";
import { downloadCertificateFromDrive, cleanupTempFile } from "@/app/lib/sefazIntegration";

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

  let { clienteId, certificadoId, tipo_documento, data_inicio, data_fim } = await request.json();

  if (!clienteId || !certificadoId) {
    return NextResponse.json({ error: "clienteId e certificadoId sao obrigatorios" }, { status: 400 });
  }

  if (!data_inicio || !data_fim) {
    return NextResponse.json({ error: "data_inicio e data_fim sao obrigatorios" }, { status: 400 });
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

    // Baixar certificado do Google Drive
    let certificadoPath: string | null = null;
    let quantidadeEncontrada = 0;
    let quantidadeImportada = 0;
    let quantidadeErro = 0;
    let mensagemSincronizacao = "";

    try {
      if (!certificado.drive_file_id) {
        throw new Error("Certificado nao possui arquivo associado");
      }

      if (!certificado.senha_criptografada) {
        throw new Error("Certificado nao possui senha cadastrada");
      }

      // Download certificado do Google Drive
      certificadoPath = await downloadCertificateFromDrive(certificado.drive_file_id);

      // Descriptografar senha
      const senhaCertificado = decryptSecret(certificado.senha_criptografada);

      // Sincronizar NFSes Emitidas
      const { nfses: nfsesEmitidas, error: erroEmitidas } = await loginAndDownloadNFSes(
        certificadoPath,
        senhaCertificado,
        cliente.identificacao,
        "Emitidas",
        data_inicio,
        data_fim
      );

      if (erroEmitidas) {
        console.warn("Erro ao baixar NFSes emitidas:", erroEmitidas);
      }

      // Sincronizar NFSes Recebidas
      const { nfses: nfsesRecebidas, error: erroRecebidas } = await loginAndDownloadNFSes(
        certificadoPath,
        senhaCertificado,
        cliente.identificacao,
        "Recebidas",
        data_inicio,
        data_fim
      );

      if (erroRecebidas) {
        console.warn("Erro ao baixar NFSes recebidas:", erroRecebidas);
      }

      const todasNFSes = [...nfsesEmitidas, ...nfsesRecebidas];
      quantidadeEncontrada = todasNFSes.length;

      if (quantidadeEncontrada === 0) {
        mensagemSincronizacao = "Nenhuma NFSe encontrada no portal nacional.";
      } else {
        // Processar cada NFSe
        for (const nfse of todasNFSes) {
          try {
            const origem = nfsesEmitidas.includes(nfse) ? "Emitidas" : "Recebidas";
            const fileName = `${nfse.numero || "nota"}.xml`;

            // Upload para Google Drive
            await uploadNFSeXmlToDrive(
              nfse.xml,
              fileName,
              cliente.razao_social,
              cliente.identificacao,
              origem,
              nfse.mes
            );

            // Extrair dados e salvar no Supabase
            const nfseData = await extractNFSeDataFromXml(nfse.xml);

            if (nfseData) {
              const xmlPath = `NFSe/${cliente.razao_social}/${origem}/${nfse.mes}/${fileName}`;

              await adminClient
                .from("documentos_fiscais")
                .insert({
                  cliente_id: clienteId,
                  tipo_documento: "NFSe",
                  numero: nfseData.numero || nfse.numero,
                  serie: nfseData.serie || nfse.serie,
                  chave_acesso: nfseData.chave_acesso || nfse.chave_acesso,
                  data_emissao: nfseData.data_emissao || nfse.data_emissao,
                  valor_total: parseFloat(nfseData.valor || nfse.valor || "0"),
                  origem: origem as "Recebidas" | "Emitidas",
                  status: "Importada",
                  xml_storage_path: xmlPath,
                  sincronizacao_id: sincSync.id,
                });

              quantidadeImportada++;
            }
          } catch (nfseError) {
            quantidadeErro++;
            console.error(`Erro ao processar NFSe ${nfse.numero}:`, nfseError);
          }
        }

        mensagemSincronizacao = `Sincronizacao concluída: ${quantidadeImportada} notas importadas, ${quantidadeErro} com erro.`;
      }

      if (certificadoPath) {
        await cleanupTempFile(certificadoPath);
      }
    } catch (syncError) {
      const errorMsg = syncError instanceof Error ? syncError.message : "Erro desconhecido";
      mensagemSincronizacao = `Erro na sincronização: ${errorMsg}`;
      quantidadeErro = quantidadeEncontrada;
    }

    // Atualizar registro de sincronização
    await adminClient
      .from("documentos_fiscais_sincronizacoes")
      .update({
        status: quantidadeErro === 0 && quantidadeImportada > 0 ? "Concluída" : "Com erro",
        data_fim: new Date().toISOString(),
        quantidade_encontrada: quantidadeEncontrada,
        quantidade_importada: quantidadeImportada,
        quantidade_erro: quantidadeErro,
        mensagem: mensagemSincronizacao,
      })
      .eq("id", sincSync.id);

    return NextResponse.json({
      sucesso: quantidadeErro === 0 || quantidadeImportada > 0,
      mensagem: mensagemSincronizacao,
      sincronizacao: {
        id: sincSync.id,
        status: quantidadeErro === 0 && quantidadeImportada > 0 ? "Concluída" : "Com erro",
        quantidade_encontrada: quantidadeEncontrada,
        quantidade_importada: quantidadeImportada,
        quantidade_erro: quantidadeErro,
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
