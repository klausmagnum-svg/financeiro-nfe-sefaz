import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClientDocumentFolderStructure, uploadDriveFile } from "@/app/lib/googleDriveServer";
import { decryptSecret } from "@/app/lib/certificateCrypto";
import { downloadCertificateFromDrive, cleanupTempFile, syncNFesFromSefaz } from "@/app/lib/sefazIntegration";

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

function canSincronizarNFe(usuario: any) {
  const perfil = (usuario.perfil ?? "").toLowerCase();
  if (["administrador", "gestor"].includes(perfil)) return true;
  return Boolean(usuario.permissoes?.["documentos_fiscais.sincronizar"]);
}

export async function POST(request: Request) {
  const authResult = await authorize(request);
  if ("error" in authResult) return authResult.error;

  const { adminClient, usuario } = authResult;

  if (!canSincronizarNFe(usuario)) {
    return NextResponse.json({ error: "Permissao insuficiente para sincronizar NF-es" }, { status: 403 });
  }

  let { clienteId, certificadoId, tipo_documento, ambiente } = await request.json();

  if (!clienteId || !certificadoId) {
    return NextResponse.json({ error: "clienteId e certificadoId sao obrigatorios" }, { status: 400 });
  }

  tipo_documento = tipo_documento || "NFe";
  ambiente = ambiente || "homologacao";

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
        status: "Sincronizando",
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

    // Realizar sincronização com Sefaz
    let quantidadeEncontrada = 0;
    let quantidadeImportada = 0;
    let quantidadeErro = 0;
    let mensagemSincronizacao = "";
    let certificadoPath: string | null = null;

    try {
      // Validar certificado
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

      // Sincronizar com Sefaz
      const { documentos, error: sefazError } = await syncNFesFromSefaz(
        certificadoPath,
        senhaCertificado,
        cliente.identificacao,
        ambiente
      );

      if (sefazError) {
        throw new Error(sefazError);
      }

      quantidadeEncontrada = documentos.length;

      if (quantidadeEncontrada === 0) {
        mensagemSincronizacao = "Nenhuma NF-e encontrada no Sefaz.";
      } else {
        // Processar cada documento
        const nfesFolderId = (folderStructure.structure as any)["NFe"]?.["Recebidas"];
        if (!nfesFolderId) {
          throw new Error("Pasta Recebidas nao foi criada no Google Drive");
        }

        const sefazClient = require("@/app/lib/sefazClient");

        for (const doc of documentos) {
          try {
            // Fazer upload do XML para Google Drive
            const xmlBlob = new Blob([doc.xml], { type: "application/xml" });
            const xmlFile = new File([xmlBlob], `${doc.chave_acesso}.xml`, { type: "application/xml" });

            const uploadedFile = await uploadDriveFile(xmlFile, nfesFolderId);

            // Extrair dados do XML
            const nfeData = sefazClient.extractNFeDataFromXml(doc.xml);

            if (nfeData.error) {
              quantidadeErro++;
              continue;
            }

            // Inserir em documentos_fiscais
            const { error: insertError } = await adminClient
              .from("documentos_fiscais")
              .insert({
                cliente_id: clienteId,
                tipo_documento: "NFe",
                origem: "Recebida",
                numero_nf: nfeData.numero,
                serie: nfeData.serie,
                chave_acesso: doc.chave_acesso,
                data_emissao: nfeData.data_emissao,
                emitente_cnpj: nfeData.emitente_cnpj,
                emitente_nome: nfeData.emitente_nome,
                destinatario_cnpj: nfeData.destinatario_cnpj,
                destinatario_nome: nfeData.destinatario_nome,
                valor_total: nfeData.valor_total,
                municipio: nfeData.municipio,
                uf: nfeData.uf,
                xml_storage_path: `google-drive:${uploadedFile.id}`,
                status: "Sincronizado",
                sincronizacao_id: sincSync.id,
              });

            if (insertError) {
              quantidadeErro++;
            } else {
              quantidadeImportada++;
            }
          } catch (docError) {
            quantidadeErro++;
          }
        }

        mensagemSincronizacao = `Encontradas ${quantidadeEncontrada} NF-es, importadas ${quantidadeImportada}, erros ${quantidadeErro}.`;
      }
    } catch (sefazError) {
      mensagemSincronizacao = `Erro na sincronizacao: ${sefazError instanceof Error ? sefazError.message : "Desconhecido"}`;
      quantidadeErro = quantidadeEncontrada > 0 ? quantidadeEncontrada : 1;
    } finally {
      // Limpar arquivo temporario do certificado
      if (certificadoPath) {
        await cleanupTempFile(certificadoPath);
      }
    }

    // Atualizar status final
    const statusFinal = quantidadeErro > 0 ? "PartialSucesso" : "Sucesso";

    await adminClient
      .from("clientes")
      .update({
        ultima_sincronizacao_nfe: new Date().toISOString(),
        ultima_sincronizacao_nfe_status: statusFinal,
        mensagem_ultima_sincronizacao_nfe: mensagemSincronizacao,
      })
      .eq("id", clienteId);

    await adminClient
      .from("documentos_fiscais_sincronizacoes")
      .update({
        status: statusFinal,
        data_fim: new Date().toISOString(),
        quantidade_encontrada: quantidadeEncontrada,
        quantidade_importada: quantidadeImportada,
        quantidade_erro: quantidadeErro,
        mensagem: mensagemSincronizacao,
      })
      .eq("id", sincSync.id);

    await adminClient
      .from("cliente_certificados")
      .update({
        ultimo_uso_em: new Date().toISOString(),
      })
      .eq("id", certificadoId);

    return NextResponse.json({
      sucesso: quantidadeErro === 0,
      mensagem: mensagemSincronizacao,
      sincronizacao: {
        id: sincSync.id,
        status: statusFinal,
        pasta_criada: true,
        quantidade_encontrada: quantidadeEncontrada,
        quantidade_importada: quantidadeImportada,
        quantidade_erro: quantidadeErro,
      },
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro desconhecido na sincronizacao";

    return NextResponse.json({ erro: mensagem, sucesso: false }, { status: 500 });
  }
}
