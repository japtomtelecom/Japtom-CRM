// Envío del correo de confirmación del respaldo semanal, vía Gmail SMTP con
// una "Contraseña de aplicación" (App Password) de la cuenta que guarda los
// archivos en Drive.
//
// Variables de entorno necesarias (ver .env.local.example):
//   GMAIL_USER            (la cuenta que manda el correo, ej. adm.compusistembolivia@gmail.com)
//   GMAIL_APP_PASSWORD    (contraseña de aplicación de 16 caracteres de esa cuenta)
//   BACKUP_EMAIL_TO       (a quién avisar, por defecto japtomtelecom@gmail.com)

import nodemailer from 'nodemailer';

function transportador() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function enviarCorreoRespaldoOk(resultados) {
  const destino = process.env.BACKUP_EMAIL_TO || 'japtomtelecom@gmail.com';
  const fecha = new Date().toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });

  const filas = resultados
    .map(
      (r) =>
        `<li><strong>${r.ciudad}</strong>: ${r.nombreArchivo} (${r.actualizado ? 'actualizado' : 'creado'}) — <a href="${r.webViewLink}">ver en Drive</a></li>`
    )
    .join('');

  await transportador().sendMail({
    from: `"CRM JapTom Telecom" <${process.env.GMAIL_USER}>`,
    to: destino,
    subject: `✅ Respaldo semanal del CRM completado — ${fecha}`,
    html: `
      <p>El respaldo automático semanal del CRM se ejecutó correctamente el <strong>${fecha}</strong>.</p>
      <p>Archivos guardados/actualizados en Google Drive:</p>
      <ul>${filas}</ul>
      <p style="color:#666;font-size:12px;">Este correo se envía automáticamente cada vez que corre el respaldo. No requiere ninguna acción.</p>
    `,
  });
}

export async function enviarCorreoRespaldoError(error) {
  const destino = process.env.BACKUP_EMAIL_TO || 'japtomtelecom@gmail.com';
  const fecha = new Date().toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });

  try {
    await transportador().sendMail({
      from: `"CRM JapTom Telecom" <${process.env.GMAIL_USER}>`,
      to: destino,
      subject: `⚠️ Falló el respaldo semanal del CRM — ${fecha}`,
      html: `
        <p>El respaldo automático semanal del CRM <strong>falló</strong> el ${fecha}.</p>
        <p>Detalle del error:</p>
        <pre style="background:#f5f5f5;padding:10px;border-radius:6px;white-space:pre-wrap;">${String(error?.message || error)}</pre>
        <p style="color:#666;font-size:12px;">Revisá los logs del cron job en Vercel (Settings → Cron Jobs → View Logs) para más detalle.</p>
      `,
    });
  } catch {
    // Si hasta el correo de error falla (ej. credenciales de Gmail mal
    // configuradas), no hay mucho más que hacer desde acá — el error queda
    // igual en los logs de Vercel.
  }
}
