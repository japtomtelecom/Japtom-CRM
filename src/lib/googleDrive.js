// Cliente de Google Drive para el respaldo automático semanal.
// Usa OAuth2 con un "refresh token" de una cuenta de Gmail real (NO una cuenta
// de servicio) — así los archivos se guardan con el espacio de almacenamiento
// normal de esa cuenta (15GB gratis), sin los problemas de cuota que tienen
// las cuentas de servicio en Google Drive personal.
//
// Variables de entorno necesarias (ver .env.local.example):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN
//   GOOGLE_DRIVE_FOLDER_ID

import { google } from 'googleapis';
import { Readable } from 'stream';

function clienteDrive() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Sube un archivo nuevo, o ACTUALIZA el contenido si ya existe un archivo con
// el mismo nombre dentro de la carpeta configurada (GOOGLE_DRIVE_FOLDER_ID).
// Esto es lo que hace que el respaldo "actualice datos" en vez de acumular un
// archivo nuevo cada semana: el archivo del mes en curso se pisa cada vez que
// corre el cron, y solo cuando cambia el mes se crea uno nuevo.
export async function subirOActualizarArchivo(nombreArchivo, bufferXlsx) {
  const drive = clienteDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const buscar = await drive.files.list({
    q: `name='${nombreArchivo.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  });

  const media = { mimeType: MIME_XLSX, body: Readable.from(bufferXlsx) };

  if (buscar.data.files?.length) {
    const fileId = buscar.data.files[0].id;
    const actualizado = await drive.files.update({
      fileId,
      media,
      fields: 'id, name, webViewLink',
    });
    return { ...actualizado.data, actualizado: true };
  }

  const creado = await drive.files.create({
    requestBody: { name: nombreArchivo, parents: [folderId] },
    media,
    fields: 'id, name, webViewLink',
  });
  return { ...creado.data, actualizado: false };
}
