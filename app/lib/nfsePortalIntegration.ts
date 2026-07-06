import { chromium } from "playwright";
import { parseStringPromise } from "xml2js";

export interface NFSeData {
  numero: string;
  serie: string;
  chave_acesso: string;
  data_emissao: string;
  valor: string;
  emitente: string;
  tomador: string;
  xml: string;
  mes: string;
}

export async function loginAndDownloadNFSes(
  certificatePath: string,
  certificatePassword: string,
  clienteCNPJ: string,
  origem: "Emitidas" | "Recebidas" = "Emitidas",
  dataInicio?: string,
  dataFim?: string
): Promise<{
  nfses: NFSeData[];
  error: string | null;
}> {
  let browser = null;

  try {
    // Iniciar navegador com suporte a certificado
    browser = await chromium.launch({
      headless: true,
      args: [
        `--client-cert=${certificatePath}`,
        `--client-cert-password=${certificatePassword}`,
      ],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Acessar o portal nacional de NFSe
    const portalUrl = `https://www.nfse.gov.br/EmissorNacional/Notas/${origem}`;
    console.log(`Acessando portal: ${portalUrl}`);

    await page.goto(portalUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Aguardar carregamento da página (pode ter login automático com certificado)
    await page.waitForTimeout(2000);

    // Procurar por notas na página
    const nfsesFound = await page.locator('[data-testid="nfse-row"]').count();

    if (nfsesFound === 0) {
      console.log("Nenhuma NFSe encontrada no portal");
      return { nfses: [], error: null };
    }

    const nfses: NFSeData[] = [];
    const dateInicio = dataInicio ? new Date(dataInicio) : null;
    const dateFim = dataFim ? new Date(dataFim) : null;

    // Iterar sobre cada nota encontrada
    for (let i = 0; i < nfsesFound; i++) {
      try {
        const row = page.locator('[data-testid="nfse-row"]').nth(i);

        // Extrair informações da linha
        const numero = await row.locator('[data-testid="numero"]').textContent();
        const valor = await row.locator('[data-testid="valor"]').textContent();
        const dataEmissao = await row.locator('[data-testid="data"]').textContent();
        const emitente = await row.locator('[data-testid="emitente"]').textContent();
        const tomador = await row.locator('[data-testid="tomador"]').textContent();

        // Procurar por link de download do XML
        const downloadLink = await row.locator('[data-testid="download-xml"]').getAttribute("href");

        if (!downloadLink) {
          console.log(`Nota ${numero} não tem link de download`);
          continue;
        }

        // Baixar o XML
        const xmlResponse = await page.goto(downloadLink, { waitUntil: "networkidle" });
        const xmlContent = await xmlResponse?.text() || "";

        if (!xmlContent) {
          console.log(`Não foi possível baixar XML da nota ${numero}`);
          continue;
        }

        // Extrair dados do XML
        const xmlData = await parseStringPromise(xmlContent);
        const chaveAcesso = extractFromXml(xmlData, "chaveAcesso") || "";
        const serie = extractFromXml(xmlData, "serie") || "001";
        const mes = dataEmissao ? new Date(dataEmissao).toLocaleString("pt-BR", { month: "2-digit" }) : "00";

        // Filtrar por período se especificado
        if (dataEmissao && dateInicio && dateFim) {
          const nfseDate = new Date(dataEmissao);
          if (nfseDate < dateInicio || nfseDate > dateFim) {
            console.log(`NFSe ${numero} fora do período especificado`);
            continue;
          }
        }

        nfses.push({
          numero: numero?.trim() || "",
          serie,
          chave_acesso: chaveAcesso,
          data_emissao: dataEmissao?.trim() || "",
          valor: valor?.trim() || "",
          emitente: emitente?.trim() || "",
          tomador: tomador?.trim() || "",
          xml: xmlContent,
          mes,
        });
      } catch (rowError) {
        console.error(`Erro ao processar nota ${i}:`, rowError);
        continue;
      }
    }

    await browser.close();
    return { nfses, error: null };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro ao sincronizar NFSes:", errorMsg);
    return { nfses: [], error: errorMsg };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function extractFromXml(xmlData: any, field: string): string | null {
  try {
    // Tentar extrair do XML parseado (estrutura pode variar)
    const nfse = xmlData?.nfse?.[0] || xmlData?.NFSe?.[0];
    if (!nfse) return null;

    const value = nfse[field]?.[0];
    return typeof value === "string" ? value : value?.["_"] || null;
  } catch {
    return null;
  }
}

export async function extractNFSeDataFromXml(xmlContent: string): Promise<Partial<NFSeData> | null> {
  try {
    const xmlData = await parseStringPromise(xmlContent);
    const nfse = xmlData?.nfse?.[0] || xmlData?.NFSe?.[0];

    if (!nfse) return null;

    return {
      numero: nfse.numero?.[0] || nfse.identificacaoNFSe?.[0]?.numero?.[0],
      serie: nfse.serie?.[0] || "001",
      chave_acesso: nfse.chaveAcesso?.[0] || "",
      data_emissao: nfse.dataEmissao?.[0] || nfse.dhEmissao?.[0],
      valor: nfse.valorServicos?.[0] || nfse.valorNFSe?.[0],
      emitente: nfse.prestador?.[0]?.razaoSocial?.[0] || "",
      tomador: nfse.tomador?.[0]?.razaoSocial?.[0] || "",
    };
  } catch (error) {
    console.error("Erro ao extrair dados do XML:", error);
    return null;
  }
}
