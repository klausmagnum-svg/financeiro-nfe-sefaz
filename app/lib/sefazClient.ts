export type SefazEnvironment = "producao" | "homologacao";

interface NFeResultado {
  numero: string;
  serie: string;
  chave_acesso: string;
  data_emissao: string;
  xml: string;
}

const SEFAZ_URLS = {
  producao: "https://nfe.fazenda.gov.br/NfeConsultacao4/NfeConsultacao4.asmx?WSDL",
  homologacao: "https://nfe.homolog.fazenda.gov.br/NfeConsultacao4/NfeConsultacao4.asmx?WSDL",
};

export async function connectToSefazWS(
  certificatePath: string,
  certificatePassword: string,
  environment: SefazEnvironment = "producao"
) {
  try {
    // Use dynamic require para evitar problemas com Turbopack
    const soap = require("soap");
    const fs = require("fs");

    if (!soap || !soap.createClientAsync) {
      throw new Error("Modulo 'soap' nao carregado corretamente");
    }

    const wsdlUrl = SEFAZ_URLS[environment];

    const options = {
      cert: fs.readFileSync(certificatePath),
      key: fs.readFileSync(certificatePath),
      passphrase: certificatePassword,
      rejectUnauthorized: false,
      secureOptions: 0,
    };

    const client = await soap.createClientAsync(wsdlUrl, options as any);

    return { client, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao conectar com Sefaz";
    return { client: null, error: message };
  }
}

export async function downloadNFeFromSefaz(
  client: any,
  nsuInicial: number,
  nsuFinal: number
) {
  try {
    if (!client) {
      return { documentos: [], error: "Cliente SOAP não inicializado" };
    }

    const args = {
      nsuInicial,
      nsuFinal,
    };

    const result = await client.nfeResultadoNFeAsync(args);

    if (!result || !result[0]) {
      return { documentos: [], error: null };
    }

    const response = result[0];
    const documentos: NFeResultado[] = [];

    if (response.listaNFe && Array.isArray(response.listaNFe)) {
      for (const nfe of response.listaNFe) {
        if (nfe.retConsResCom && nfe.retConsResCom.resNFe) {
          const nfeData = nfe.retConsResCom.resNFe;
          documentos.push({
            numero: nfeData.nfe?.infNFe?.ide?.nNF?.[0] || "",
            serie: nfeData.nfe?.infNFe?.ide?.serie?.[0] || "",
            chave_acesso: nfeData.chNFe?.[0] || "",
            data_emissao: nfeData.nfe?.infNFe?.ide?.dhEmi?.[0] || "",
            xml: nfeData.nfeProc ? JSON.stringify(nfeData.nfeProc) : "",
          });
        }
      }
    }

    return { documentos, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao baixar NF-es";
    return { documentos: [], error: message };
  }
}

export function extractNFeDataFromXml(xmlString: string) {
  try {
    const xml2js = require("xml2js");
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = parser.parseStringSync(xmlString);

    const nfe = parsed?.NFe?.infNFe || {};
    const ide = nfe?.ide || {};
    const emit = nfe?.emit || {};
    const dest = nfe?.dest || {};
    const total = nfe?.total?.ICMSTot || {};

    return {
      numero: ide.nNF || "",
      serie: ide.serie || "",
      data_emissao: ide.dhEmi || ide.dEmi || "",
      emitente_cnpj: emit.CNPJ || emit.CPF || "",
      emitente_nome: emit.xNome || "",
      destinatario_cnpj: dest.CNPJ || dest.CPF || "",
      destinatario_nome: dest.xNome || "",
      valor_total: parseFloat(total.vNF || "0"),
      municipio: emit.enderEmit?.xMun || "",
      uf: emit.enderEmit?.UF || "",
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao extrair dados do XML";
    return {
      numero: "",
      serie: "",
      data_emissao: "",
      emitente_cnpj: "",
      emitente_nome: "",
      destinatario_cnpj: "",
      destinatario_nome: "",
      valor_total: 0,
      municipio: "",
      uf: "",
      error: message,
    };
  }
}

export function getNFeLinkFromChaveAcesso(chaveAcesso: string, environment: SefazEnvironment = "producao") {
  const domain = environment === "producao" ? "nfe.fazenda.gov.br" : "nfe.homolog.fazenda.gov.br";
  return `https://${domain}/portal/consulta.aspx?chNFe=${chaveAcesso}`;
}
