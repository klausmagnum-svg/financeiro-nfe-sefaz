import { createSign } from "node:crypto";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
};

const driveScope = "https://www.googleapis.com/auth/drive.file";

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function loadServiceAccount() {
  const base64Credentials = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64;
  if (!base64Credentials) {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 nao configurado.");
  }

  const decodedJson = Buffer.from(base64Credentials, "base64").toString("utf-8");
  return JSON.parse(decodedJson) as ServiceAccount;
}

async function getAccessToken() {
  const serviceAccount = await loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: driveScope,
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const signature = signer.sign(serviceAccount.private_key);
  const jwt = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Nao foi possivel autenticar no Google Drive.");
  }

  return data.access_token as string;
}

export function getDriveRootFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID nao configurado.");
  }
  return folderId;
}

export async function createDriveFolder(name: string, parentId = getDriveRootFolderId()) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Nao foi possivel criar a pasta no Google Drive.");
  }

  return data as Pick<DriveFile, "id" | "name" | "webViewLink">;
}

export async function uploadDriveFile(file: File, folderId: string) {
  const accessToken = await getAccessToken();
  const metadata = {
    name: file.name,
    parents: [folderId],
  };
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", file);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Nao foi possivel enviar o arquivo para o Google Drive.");
  }

  return data as DriveFile;
}

export async function deleteDriveFile(fileId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok || response.status === 404) return;

  const deleteError = await response.json().catch(() => ({}));
  const trashResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,trashed`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    }
  );

  if (!trashResponse.ok && trashResponse.status !== 404) {
    const trashError = await trashResponse.json().catch(() => ({}));
    throw new Error(
      trashError.error?.message ||
      deleteError.error?.message ||
      "Nao foi possivel excluir o arquivo do Google Drive."
    );
  }
}

export async function getDriveFile(fileId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed,webViewLink&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Arquivo do certificado nao localizado no Google Drive.");
  }

  return data as DriveFile & { trashed?: boolean };
}

export async function createClientDocumentFolderStructure(
  clienteNome: string,
  clienteCNPJCPF: string,
  documentosFiscaisParentId?: string
) {
  const rootFolderId = documentosFiscaisParentId || process.env.GOOGLE_DRIVE_DOCUMENTOS_FISCAIS_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_DOCUMENTOS_FISCAIS_FOLDER_ID nao configurado.");
  }

  const clienteFolderName = `${clienteNome} (${clienteCNPJCPF})`;
  const documentTypes = ["NFe", "NFSe", "CTe", "MDFe", "NFCe"];
  const origins = ["Recebidas", "Emitidas"];

  const structure: Record<string, Record<string, string>> = {};

  try {
    const clienteFolder = await createDriveFolder(clienteFolderName, rootFolderId);
    structure["cliente"] = { id: clienteFolder.id, name: clienteFolder.name };

    for (const docType of documentTypes) {
      structure[docType] = {};
      const typeFolder = await createDriveFolder(docType, clienteFolder.id);

      for (const origin of origins) {
        const originFolder = await createDriveFolder(origin, typeFolder.id);
        structure[docType][origin] = originFolder.id;
      }
    }

    return { success: true, structure, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar estrutura de pastas";
    return { success: false, structure: {}, error: message };
  }
}
