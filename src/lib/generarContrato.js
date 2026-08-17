import jsPDF from 'jspdf';

async function cargarImagenBase64(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const REPRESENTANTE_NOMBRE = 'Jaime Antonio Arriaza Prieto';
const REPRESENTANTE_CI = '3321656 LP';

const CUENTAS_EL_ALTO = [
  '4066830387 — Banco Mercantil Santa Cruz',
  '201-50462127-3-27 — Banco de Crédito BCP',
  '1570083372 — Banco Nacional de Bolivia BNB',
  '507736000001 — Banco Sol',
  '40014904400 — Banco Fie',
];
const TITULAR_EL_ALTO = 'Jaime Antonio Arriaza Prieto';

const CUENTAS_TARIJA = [
  '201-50891769-3-08 — Banco de Crédito BCP',
  '10000007370773 — Banco Unión',
  '40-0-2307950-1 — Banco Fie',
];
const TITULAR_TARIJA = 'Marisol Ticona Ortega';

function formatBs(n) {
  return `Bs. ${Number(n || 0).toFixed(0)}`;
}

function verificarSalto(doc, y, limite = 270) {
  if (y > limite) {
    doc.addPage();
    return 20;
  }
  return y;
}

function parrafo(doc, texto, x, y, ancho, lineHeight = 5) {
  const lineas = doc.splitTextToSize(texto, ancho);
  doc.text(lineas, x, y);
  return y + lineas.length * lineHeight;
}

function tituloClausula(doc, titulo, x, y, ancho) {
  y = verificarSalto(doc, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  y = parrafo(doc, titulo, x, y, ancho, 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return y + 2;
}

export async function generarContrato(cliente, empresaNombre = 'JapTom Telecom', fechaFirma = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margenX = 20;
  const anchoUtil = 210 - margenX * 2;
  let y = 18;

  try {
    const logoBase64 = await cargarImagenBase64('/logo.png');
    doc.addImage(logoBase64, 'PNG', margenX, y - 6, 24, 24);
  } catch (e) {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CONTRATO DE PRESTACIÓN', 105, y + 4, { align: 'center' });
  y += 10;
  doc.text('DE SERVICIO DE ACCESO A LA RED DE INTERNET', 105, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = parrafo(
    doc,
    'Conste por el presente contrato de prestación de servicio de acceso a Internet mediante Fibra Óptica, que se tiene conformidad a las siguientes cláusulas:',
    margenX,
    y,
    anchoUtil
  );
  y += 6;

  const esTarija = cliente.ciudad === 'Tarija';
  const cuentas = esTarija ? CUENTAS_TARIJA : CUENTAS_EL_ALTO;
  const titularCuentas = esTarija ? TITULAR_TARIJA : TITULAR_EL_ALTO;
  const ciudadFirma = esTarija ? 'Tarija' : 'La Paz';

  y = tituloClausula(doc, 'PRIMERA: LAS PARTES.', margenX, y, anchoUtil);
  y = parrafo(doc, 'Son Partes del presente contrato:', margenX, y, anchoUtil);
  y += 3;
  y = parrafo(
    doc,
    `a) La empresa JAPTOM-TELECOM representado Legalmente por el Señor ${REPRESENTANTE_NOMBRE} con Cédula de identidad ${REPRESENTANTE_CI}.`,
    margenX,
    y,
    anchoUtil
  );
  y += 3;
  y = parrafo(
    doc,
    `b) El señor(a) ${cliente.nombre} número de C.I. ${cliente.ci || '_______________'} domiciliado ${
      cliente.direccion || '_______________'
    }, Teléfono ${cliente.telefono || '_______________'}, que en adelante se denominará el ABONADO.`,
    margenX,
    y,
    anchoUtil
  );
  y += 6;

  y = tituloClausula(doc, 'SEGUNDA: OBJETO.', margenX, y, anchoUtil);
  y = parrafo(
    doc,
    'El presente contrato tiene por objeto la estipulación de obligaciones y derechos de las partes para la provisión de la red de Internet.',
    margenX,
    y,
    anchoUtil
  );
  y += 2;
  y = parrafo(doc, `El abonado pagará a JAPTOM-TELECOM los siguientes conceptos:`, margenX, y, anchoUtil);
  y += 4;

  y = verificarSalto(doc, y);
  doc.setFont('helvetica', 'bold');
  y = parrafo(doc, 'a) Tarifa de instalación', margenX, y, anchoUtil);
  doc.setFont('helvetica', 'normal');
  const montoInstalacion = cliente.costo_instalacion ? formatBs(cliente.costo_instalacion) : 'Bs. _______________';
  y = parrafo(
    doc,
    `Precio establecido previamente e indicado en la cotización del servicio de instalación de Fibra óptica ${montoInstalacion}`,
    margenX,
    y,
    anchoUtil
  );
  y += 4;

  y = verificarSalto(doc, y);
  doc.setFont('helvetica', 'bold');
  y = parrafo(doc, 'b) Tarifa mensual', margenX, y, anchoUtil);
  doc.setFont('helvetica', 'normal');
  y = parrafo(
    doc,
    `Estipulada en la carta de presentación con tarifas, deberá ser cancelada por el abonado, en la Modalidad Pre-Pago, el Plan acordado ${
      cliente.plan || '_______________'
    } (${cliente.velocidad || '_______________'}) ${formatBs(cliente.precio)}.`,
    margenX,
    y,
    anchoUtil
  );
  y += 5;

  y = verificarSalto(doc, y);
  doc.setFont('helvetica', 'bold');
  y = parrafo(doc, 'Números de cuenta', margenX, y, anchoUtil);
  doc.setFont('helvetica', 'normal');
  cuentas.forEach((c) => {
    y = verificarSalto(doc, y);
    y = parrafo(doc, `•  ${c}`, margenX + 2, y, anchoUtil - 2);
  });
  y = parrafo(doc, `A nombre de ${titularCuentas}`, margenX, y, anchoUtil);
  y += 5;

  y = verificarSalto(doc, y);
  y = parrafo(
    doc,
    'c) La velocidad mínima o en horarios pico no tendría que ser menor al 80% del plan contratado.',
    margenX,
    y,
    anchoUtil
  );
  y += 3;
  y = verificarSalto(doc, y);
  doc.setFont('helvetica', 'bold');
  y = parrafo(
    doc,
    'd) Los equipos proporcionados son en calidad de préstamo, en caso se resuelva dar de baja los equipos tienen que ser devueltos. Si el equipo sufre algún daño el abonado se hace enteramente responsable de la reposición del mismo, teniendo un costo de Bs. 500 en el caso de no cancelar, no se podrá restablecer el servicio.',
    margenX,
    y,
    anchoUtil
  );
  doc.setFont('helvetica', 'normal');
  y += 3;
  y = verificarSalto(doc, y);
  y = parrafo(
    doc,
    'e) El abonado debe tener en su domicilio la protección respectiva como ser, estabilizador de voltaje o toma a tierra.',
    margenX,
    y,
    anchoUtil
  );
  y += 6;

  y = tituloClausula(doc, 'TERCERA: SUSPENSIONES E INTERRUPCIONES.', margenX, y, anchoUtil);
  y = parrafo(
    doc,
    'El SERVICIO será prestado en favor del ABONADO de modo continuo, salvo suspensiones o interrupciones no imputables a JAPTOM-TELECOM ocasionadas por razones de fuerza mayor.',
    margenX,
    y,
    anchoUtil
  );
  y += 2;
  y = parrafo(
    doc,
    'En caso de interrupción del SERVICIO, el abonado deberá comunicar a JAPTOM-TELECOM, mediante correo o las líneas telefónicas habilitadas para este propósito (77766262 — 71537257), para que el SERVICIO sea restablecido en un plazo no mayor a 48 horas en días hábiles, si corresponde. Asimismo, en casos de interrupciones previstas del SERVICIO, JAPTOM-TELECOM comunicará a través de correo electrónico o vía telefónica al abonado.',
    margenX,
    y,
    anchoUtil
  );
  y += 6;

  y = tituloClausula(doc, 'CUARTA: TIEMPO DE CONTRATO Y SANCIONES POR INCUMPLIMIENTO.', margenX, y, anchoUtil);
  y = parrafo(
    doc,
    'El contrato tiene una validez de 12 meses a partir de la firma del mismo. En caso de mora o incumplimiento parcial de las obligaciones adquiridas por el ABONADO, JAPTOM-TELECOM podrá exigir a éste, el pago de multas sucesivas equivalentes al veinte por ciento (20%) del valor total de los meses restantes del contrato.',
    margenX,
    y,
    anchoUtil
  );
  y += 6;

  y = tituloClausula(doc, 'QUINTA: CONFORMIDAD.', margenX, y, anchoUtil);
  y = parrafo(
    doc,
    'Estando ambas partes de acuerdo con lo anteriormente mencionado, firmamos nuestra conformidad.',
    margenX,
    y,
    anchoUtil
  );
  y += 10;

  y = verificarSalto(doc, y, 250);
  const ahora = fechaFirma ? new Date(fechaFirma + 'T00:00:00') : new Date();
  const fechaTexto = ahora.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  y = parrafo(doc, `${ciudadFirma}, ${fechaTexto}`, margenX, y, anchoUtil);
  y += 26;

  y = verificarSalto(doc, y, 260);

  // Firma escaneada del representante de JAPTOM-TELECOM, si está disponible
  try {
    const firmaBase64 = await cargarImagenBase64('/firma.png');
    const firmaAncho = 36.4; // 28 + 30%
    const firmaAlto = firmaAncho * (315 / 327); // proporción real de la imagen recortada
    doc.addImage(firmaBase64, 'PNG', margenX + 6, y - firmaAlto - 1, firmaAncho, firmaAlto);
  } catch (e) {}

  doc.setDrawColor(120);
  doc.line(margenX, y, 90, y);
  doc.line(120, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(REPRESENTANTE_NOMBRE, margenX, y);
  doc.text(cliente.nombre, 120, y);
  y += 5;
  doc.text(`C.I. ${REPRESENTANTE_CI}`, margenX, y);
  doc.text(`C.I. ${cliente.ci || '_______________'}`, 120, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('JAPTOM-TELECOM', margenX, y);
  doc.text('ABONADO', 120, y);

  const nombreArchivo = `Contrato_${cliente.codigo}_${cliente.nombre.replace(/\s+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}