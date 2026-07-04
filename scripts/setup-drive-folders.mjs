import { createSign } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
import path from "node:path";

const rootFolderId = "0AGMrlZM9-ASOUk9PVA";
const keyPath = path.join(process.cwd(), ".secrets", "google-drive-service-account.json");
const serviceAccount = JSON.parse(await readFile(keyPath, "utf8"));

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${base64Url(signer.sign(serviceAccount.private_key))}`;
  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Falha ao autenticar no Drive.");
  return data.access_token;
}

async function findFolder(token, name, parentId) {
  const query = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
  ].join(" and ");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Falha ao buscar pasta ${name}.`);
  return data.files?.[0] ?? null;
}

async function ensureFolder(token, name, parentId) {
  const existing = await findFolder(token, name, parentId);
  if (existing) return existing;
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Falha ao criar pasta ${name}.`);
  return data;
}

const token = await getAccessToken();
const certificados = await ensureFolder(token, "Certificados Digitais", rootFolderId);
const documentos = await ensureFolder(token, "Documentos Fiscais", rootFolderId);
for (const name of ["NF-e", "NFS-e", "NFC-e", "CT-e", "Importações", "Sincronizações"]) {
  await ensureFolder(token, name, documentos.id);
}

await appendFile(".env.local", `\nGOOGLE_DRIVE_CERTIFICADOS_FOLDER_ID=${certificados.id}\nGOOGLE_DRIVE_DOCUMENTOS_FISCAIS_FOLDER_ID=${documentos.id}\n`);
console.log("Pastas do Google Drive configuradas.");
