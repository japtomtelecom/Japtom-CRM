import jsPDF from 'jspdf';

const MATERIALES = [
  'Fibra drop',
  'ONT',
  'Tensores plásticos',
  'Grampas plásticas',
  'Precintos plásticos',
  'Roseta óptica',
  'Patch cord óptico',
];

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

function parrafo(doc, texto, x, y, ancho, lineHeight = 5) {
  const lineas = doc.splitTextToSize(texto, ancho);
  doc.text(lineas, x, y);
  return y + lineas.length * lineHeight;
}

// materiales: { [nombreMaterial]: cantidad }
// observaciones: texto libre (ej: "Puerto óptico en NAP: 4")
export async function generarBoletaInstalacion(cliente, materiales, observaciones, empresaNombre = 'JapTom Telecom') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margenX = 20;
  const anchoUtil = 210 - margenX * 2;
  let y = 18;

  try {
    const logoBase64 = await cargarImagenBase64('/logo.png');
    doc.addImage(logoBase64, 'PNG', margenX, y - 6, 20, 20);
  } catch (e) {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BOLETA DE INSTALACIÓN', 105, y + 4, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(empresaNombre, 105, y, { align: 'center' });
  y += 14;

  // --- Datos del cliente ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del cliente', margenX, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const datos = [
    ['ID', cliente.codigo || '—'],
    ['Nombre', cliente.nombre || '—'],
    ['Dirección', cliente.direccion || '—'],
    ['Ciudad', cliente.ciudad || 'El Alto'],
    ['Teléfono', cliente.telefono || '—'],
    ['Plan', cliente.plan || '—'],
    ['Velocidad', cliente.velocidad || '—'],
    ['CI', cliente.ci || '—'],
  ];

  datos.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margenX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(valor), margenX + 35, y);
    y += 6;
  });

  y += 6;

  // --- Descargo de materiales ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Descargo de materiales', margenX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFillColor(230, 230, 230);
  doc.rect(margenX, y - 5, anchoUtil, 7, 'F');
  doc.text('Material', margenX + 2, y);
  doc.text('Cantidad', margenX + anchoUtil - 25, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  MATERIALES.forEach((mat) => {
    const cantidad = materiales[mat] || 0;
    doc.text(mat, margenX + 2, y);
    doc.text(String(cantidad), margenX + anchoUtil - 25, y);
    doc.setDrawColor(220);
    doc.line(margenX, y + 2, margenX + anchoUtil, y + 2);
    y += 7;
  });

  y += 6;

  // --- Observaciones ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Observaciones', margenX, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = parrafo(doc, observaciones || '—', margenX, y, anchoUtil);

  y += 20;

  // --- Firmas ---
  const ahora = new Date();
  const fechaTexto = ahora.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Fecha: ${fechaTexto}`, margenX, y);
  y += 20;

  doc.setDrawColor(120);
  doc.line(margenX, y, 90, y);
  doc.line(120, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Técnico instalador', margenX, y);
  doc.text(cliente.nombre || 'Cliente', 120, y);

  const nombreArchivo = `Boleta_Instalacion_${cliente.codigo}_${(cliente.nombre || '').replace(/\s+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
}