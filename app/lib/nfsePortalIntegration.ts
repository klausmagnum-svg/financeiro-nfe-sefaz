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

    // Esperar carregamento da tabela
    await page.waitForSelector('table.table-striped tbody tr', { timeout: 10000 });

    // Procurar por notas na página
    const nfsesFound = await page.locator('table.table-striped tbody tr').count();

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
        const row = page.locator('table.table-striped tbody tr').nth(i);

        // Extrair informações da linha (usando os seletores corretos)
        const dataHora = await row.locator('td.td-data-hora').textContent();
        const cnpjEmitente = await row.locator('td.td-texto-grande').textContent();
        const competencia = await row.locator('td.td-competencia').textContent();
        const valor = await row.locator('td.td-valor').textContent();
        const situacao = await row.locator('td.td-situacao').textContent();

        // Procurar por link de download do XML (botão ou link dentro da linha)
        const downloadLink = await row.locator('a[href*="download"], button[href*="download"]').getAttribute("href");

        if (!downloadLink) {
          console.log(`Nota ${cnpjEmitente} não tem link de download`);
          continue;
        }

        // Baixar o XML
        const xmlResponse = await page.goto(downloadLink, { waitUntil: "networkidle" });
        const xmlContent = await xmlResponse?.text() || "";

        if (!xmlContent) {
          console.log(`Não foi possível baixar XML da nota ${cnpjEmitente}`);
          continue;
        }

        // Extrair dados do XML
        const xmlData = await parseStringPromise(xmlContent);
        const chaveAcesso = extractFromXml(xmlData, "chaveAcesso") || "";
        const numero = extractFromXml(xmlData, "numero") || extractFromXml(xmlData, "nfseNumero") || `nota-${i}`;
        const serie = extractFromXml(xmlData, "serie") || "001";

        // Usar competência da tabela (MM/YYYY)
        const [mesStr, ano] = (competencia?.trim() || "01/2026").split("/");
        const mes = mesStr || "01";

        // Converter data para formato ISO (usar primeira data da linha - data-hora)
        const dataEmissaoStr = dataHora?.split(" ")[0] || `${ano}-${mes}-01`;

        // Filtrar por período se especificado
        if (dateInicio && dateFim) {
          const nfseDate = new Date(dataEmissaoStr);
          if (nfseDate < dateInicio || nfseDate > dateFim) {
            console.log(`NFSe ${numero} fora do período especificado`);
            continue;
          }
        }

        nfses.push({
          numero: numero?.trim() || "",
          serie,
          chave_acesso: chaveAcesso,
          data_emissao: dataEmissaoStr,
          valor: valor?.trim()?.replace(/[^\d.,]/g, "") || "",
          emitente: cnpjEmitente?.trim() || "",
          tomador: "",
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
