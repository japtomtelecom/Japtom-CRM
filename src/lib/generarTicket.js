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

// Genera un PDF de "Ticket de falla / soporte técnico" con los datos del cliente.
export async function generarTicketFalla(cliente, motivo, empresaNombre = 'JapTom Telecom') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margenX = 20;
  let y = 20;

  const ahora = new Date();
  const fechaTexto = ahora.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaTexto = ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  const numeroTicket = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(
    ahora.getDate()
  ).padStart(2, '0')}-${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`;

  // Logo (esquina superior izquierda)
  let textoX = margenX;
  try {
    const logoBase64 = await cargarImagenBase64('/logo.png');
    doc.addImage(logoBase64, 'PNG', margenX, y - 6, 22, 22);
    textoX = margenX + 27;
  } catch (e) {
    // si el logo no carga (ej. sin conexión), seguimos sin él
  }

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(empresaNombre, textoX, y);
  y += 7;
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text('TICKET DE FALLA / SOPORTE TÉCNICO', textoX, y);
  doc.setTextColor(0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`N° Ticket: ${numeroTicket}`, 210 - margenX, 20, { align: 'right' });
  doc.text(`Fecha: ${fechaTexto}`, 210 - margenX, 26, { align: 'right' });
  doc.text(`Hora: ${horaTexto}`, 210 - margenX, 32, { align: 'right' });

  y += 12;
  doc.setDrawColor(180);
  doc.line(margenX, y, 210 - margenX, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del cliente', margenX, y);
  y += 7;

  const filas = [
    ['ID Cliente', cliente.codigo],
    ['Nombre', cliente.nombre],
    ['Teléfono', cliente.telefono || '—'],
    ['Dirección', cliente.direccion || '—'],
    ['Plan', cliente.plan || '—'],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  filas.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margenX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor), margenX + 35, y);
    y += 7;
  });

  y += 3;
  doc.setDrawColor(180);
  doc.line(margenX, y, 210 - margenX, y);
  y += 10;

  // Motivo de la falla
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Motivo de la falla', margenX, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lineasMotivo = doc.splitTextToSize(motivo || '(sin detalle)', 210 - margenX * 2);
  doc.text(lineasMotivo, margenX, y);
  y += lineasMotivo.length * 5 + 10;

  // Espacio para observaciones técnicas
  doc.setFont('helvetica', 'bold');
  doc.text('Observaciones técnicas / solución aplicada:', margenX, y);
  y += 10;
  for (let i = 0; i < 4; i++) {
    doc.setDrawColor(200);
    doc.line(margenX, y, 210 - margenX, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(180);
  doc.line(margenX, y, 90, y);
  doc.line(120, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Firma técnico', margenX, y);
  doc.text('Firma cliente', 120, y);

  const nombreArchivo = `Ticket_Falla_${cliente.codigo}_${numeroTicket}.pdf`;
  doc.save(nombreArchivo);
}
