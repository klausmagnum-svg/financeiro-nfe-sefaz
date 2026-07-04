import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getDriveFile } from "./googleDriveServer";

export async function downloadCertificateFromDrive(driveFileId: string): Promise<string> {
  try {
    // Tentar múltiplas abordagens
    let buffer: Buffer | null = null;

    // Abordagem 1: Usar getGoogleAccessToken com cache
    try {
      const accessToken = await getGoogleAccessTokenCached();
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true`;
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }
    } catch (err) {
      console.error("Abordagem 1 falhou:", err);
    }

    // Se primeira abordagem falhou, tentar link direto de download
    if (!buffer) {
      const response = await fetch(
        `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=1`
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }
    }

    if (!buffer || buffer.length === 0) {
      throw new Error("Nao foi possivel fazer download do certificado do Google Drive");
    }

    const tempPath = join(tmpdir(), `cert_${Date.now()}.pfx`);
    await writeFile(tempPath, buffer);
    return tempPath;
  } catch (error) {
    throw new Error(
      `Erro ao baixar certificado: ${error instanceof Error ? error.message : "Desconhecido"}`
    );
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessTokenCached(): Promise<string> {
  // Se temos token em cache e ainda não expirou, use
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const token = await getGoogleAccessToken();
  cachedAccessToken = {
    token,
    expiresAt: Date.now() + 3500 * 1000, // 58 minutos
  };
  return token;
}

async function getGoogleAccessToken(): Promise<string> {
  const { createSign } = await import("crypto");

  const base64Credentials = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64;
  if (!base64Credentials) {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 nao configurado");
  }

  const decodedJson = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const serviceAccount = JSON.parse(decodedJson);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64Url = (input: string) =>
    Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const signature = signer.sign(serviceAccount.private_key);
  const jwt = `${unsignedJwt}.${base64Url(signature.toString("base64"))}`;

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || "Nao foi possivel autenticar no Google Drive");
  }

  return data.access_token;
}

export async function cleanupTempFile(filePath: string) {
  try {
    await unlink(filePath);
  } catch (error) {
    console.error(`Erro ao limpar arquivo temporario: ${filePath}`, error);
  }
}

export async function syncNFesFromSefaz(
  certificatePath: string,
  certificatePassword: string,
  clienteCNPJ: string,
  ambiente: "producao" | "homologacao" = "homologacao"
): Promise<{
  documentos: Array<{
    numero: string;
    serie: string;
    chave_acesso: string;
    data_emissao: string;
    xml: string;
  }>;
  error: string | null;
}> {
  const sefazClient = require("./sefazClient");

  try {
    const { client, error: connectError } = await sefazClient.connectToSefazWS(
      certificatePath,
      certificatePassword,
      ambiente
    );

    if (connectError || !client) {
      throw new Error(`Conexao Sefaz falhou: ${connectError}`);
    }

    const { documentos, error: downloadError } = await sefazClient.downloadNFeFromSefaz(
      client,
      0,
      999999
    );

    if (downloadError) {
      throw new Error(`Erro ao buscar NF-es: ${downloadError}`);
    }

    return { documentos: documentos ?? [], error: null };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    return { documentos: [], error: errorMsg };
  }
}
