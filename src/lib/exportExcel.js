import { supabase } from './supabaseClient';

const ETIQUETA_STATUS = {
  pagado: 'Pagado',
  no_vencido: 'Aún no vence',
  por_vencer: 'Vencido (1-5 días)',
  vencido: 'Vencido (+5 días)',
};

export const CIUDADES = ['El Alto', 'Tarija'];

// ── Estilo del Excel ────────────────────────────────────────────────────
const COLOR = {
  encabezado: 'FFA9DBF5', // celeste
  encabezadoTexto: 'FF0B3C5D',
  zebra: 'FFF2F9FD',
  borde: 'FFC5D3DD',
  gris: 'FF6B7B88',
};

// Colores de relleno según el texto de la celda (Estado, Pagado, etc.)
const COLOR_POR_TEXTO = {
  'Al día': 'FFDDF3E4',
  'Por vencer': 'FFFFF3CD',
  Vencido: 'FFFADBD8',
  Inactivo: 'FFE9ECEF',
  Pagado: 'FFDDF3E4',
  'Aún no vence': 'FFE3F1FA',
  'Vencido (1-5 días)': 'FFFFF3CD',
  'Vencido (+5 días)': 'FFFADBD8',
};

const FORMATO_BS = '#,##0.00';
const FILA_ENCABEZADO = 5; // filas 1-3: logo y título · fila 4: espacio
const LOGO_ALTO = 70;
const LOGO_ANCHO = Math.round((LOGO_ALTO * 1126) / 608); // proporción de public/logo.png

const bordeFino = {
  top: { style: 'thin', color: { argb: COLOR.borde } },
  left: { style: 'thin', color: { argb: COLOR.borde } },
  bottom: { style: 'thin', color: { argb: COLOR.borde } },
  right: { style: 'thin', color: { argb: COLOR.borde } },
};

function nombreMesCorto(periodo) {
  const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}

// Mes de un pago/trabajo como "2026-09" (mismo criterio que Estadísticas:
// se toma directo del texto de la fecha, sin correrse por zona horaria).
function mesClave(fecha) {
  return String(fecha).slice(0, 7);
}
function mesEtiqueta(clave) {
  return nombreMesCorto(clave + '-01');
}

function fechaCorta(valor) {
  return valor ? new Date(valor).toLocaleDateString('es-BO') : '';
}

// Descarga /logo.png (carpeta public) y lo devuelve en base64 para
// incrustarlo en el Excel. En el navegador basta con `cargarLogo()`; desde
// el servidor (cron) hay que pasar el origen, ej. "https://mi-crm.vercel.app".
// Si algo falla devuelve null y el Excel se genera igual, sin logo.
export async function cargarLogo(origen = '') {
  try {
    const res = await fetch(`${origen}/logo.png`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binario = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binario);
  } catch {
    return null;
  }
}

// Agrega una hoja con el estilo común: logo + título arriba, encabezados
// celestes centrados, filas con bordes y color alterno, filtros, primera
// fila fija al desplazarse y (opcional) fila de totales.
//   columnas: [{ titulo, formato?, ajuste?, total? }]
//   filas:    [{ [titulo]: valor }]
//   colorear: (titulo, valor) => argb | null   (relleno según el contenido)
function agregarHoja(wb, { nombre, ciudad, generado, logoId, columnas, filas, colorear }) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO, showGridLines: false }],
    properties: { tabColor: { argb: COLOR.encabezado } },
  });

  // Anchos de columna según el contenido (con mínimo y máximo razonables)
  const anchos = columnas.map((col) => {
    // Los encabezados largos se parten en 2 líneas: ancho ~ el título, con tope
    let max = Math.min(Math.max(String(col.titulo).length + 3, 12), 22);
    for (const fila of filas) {
      const v = fila[col.titulo];
      const largo = v === null || v === undefined ? 0 : String(v).length;
      if (largo + 3 > max) max = largo + 3;
    }
    return Math.min(max, 42);
  });
  columnas.forEach((_, i) => {
    ws.getColumn(i + 1).width = anchos[i];
  });

  // Banner: logo a la izquierda, título a su derecha
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 16;
  ws.getRow(4).height = 6;

  let colTitulo = 1;
  let acumuladoPx = 0;
  while (colTitulo < columnas.length && acumuladoPx < LOGO_ANCHO + 12) {
    acumuladoPx += anchos[colTitulo - 1] * 7 + 5;
    colTitulo += 1;
  }
  const c1 = ws.getCell(1, colTitulo);
  c1.value = 'JAPTOM TELECOM';
  c1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLOR.encabezadoTexto } };
  c1.alignment = { vertical: 'middle', horizontal: 'left' };
  const c2 = ws.getCell(2, colTitulo);
  c2.value = 'Soluciones tecnológicas en fibra óptica';
  c2.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR.gris } };
  c2.alignment = { vertical: 'middle', horizontal: 'left' };
  const c3 = ws.getCell(3, colTitulo);
  c3.value = `${nombre} · Sucursal ${ciudad} · Generado: ${generado}`;
  c3.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLOR.encabezadoTexto } };
  c3.alignment = { vertical: 'middle', horizontal: 'left' };

  if (logoId !== null && logoId !== undefined) {
    ws.addImage(logoId, {
      tl: { col: 0.08, row: 0.08 },
      ext: { width: LOGO_ANCHO, height: LOGO_ALTO },
    });
  }

  // Encabezados
  const filaEnc = ws.getRow(FILA_ENCABEZADO);
  filaEnc.height = 32;
  columnas.forEach((col, i) => {
    const celda = filaEnc.getCell(i + 1);
    celda.value = col.titulo;
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.encabezadoTexto } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.encabezado } };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = bordeFino;
  });

  // Datos
  filas.forEach((fila, idx) => {
    const r = ws.getRow(FILA_ENCABEZADO + 1 + idx);
    columnas.forEach((col, i) => {
      const celda = r.getCell(i + 1);
      const valor = fila[col.titulo];
      celda.value = valor === undefined ? null : valor;
      celda.font = { name: 'Calibri', size: 10 };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: !!col.ajuste };
      celda.border = bordeFino;
      if (col.formato) celda.numFmt = col.formato;
      const relleno = (colorear && colorear(col.titulo, valor)) || (idx % 2 === 1 ? COLOR.zebra : null);
      if (relleno) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
    });
  });

  const primera = FILA_ENCABEZADO + 1;
  const ultima = FILA_ENCABEZADO + filas.length;

  // Filtros en los encabezados
  ws.autoFilter = {
    from: { row: FILA_ENCABEZADO, column: 1 },
    to: { row: FILA_ENCABEZADO, column: columnas.length },
  };

  // Fila de totales (deja una fila en blanco para que el filtro no la incluya).
  // Usa SUBTOTAL, así el total cambia según las filas que se estén filtrando.
  if (filas.length > 0 && columnas.some((c) => c.total)) {
    const filaTot = ws.getRow(ultima + 2);
    columnas.forEach((col, i) => {
      const celda = filaTot.getCell(i + 1);
      celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.encabezadoTexto } };
      celda.alignment = { horizontal: 'center', vertical: 'middle' };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.encabezado } };
      celda.border = bordeFino;
      if (i === 0) {
        celda.value = 'TOTAL';
        celda.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (col.total) {
        const letra = ws.getColumn(i + 1).letter;
        const suma = filas.reduce((acc, f) => acc + (Number(f[col.titulo]) || 0), 0);
        celda.value = { formula: `SUBTOTAL(109,${letra}${primera}:${letra}${ultima})`, result: suma };
        if (col.formato) celda.numFmt = col.formato;
      }
    });
  }

  // Impresión: horizontal, ajustada al ancho de la hoja, con encabezados repetidos
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${FILA_ENCABEZADO}:${FILA_ENCABEZADO}`,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = { oddFooter: '&LJapTom Telecom · CRM&CPágina &P de &N&R&D' };

  return ws;
}

// Exportado para reutilizarlo desde el respaldo automático semanal
// (src/app/api/cron/respaldo-semanal/route.js) — misma lógica que el botón
// manual "⬇️ Excel" de Configuración, sin duplicar código.
//   logo: imagen en base64 (ver cargarLogo) o null para no poner logo.
export async function construirLibro(ciudad, { clientesTodos, pagosTodos, planes, registroTodo, trabajosTodos }, { logo = null } = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;

  const clientes = clientesTodos.filter((c) => (c.ciudad || 'El Alto') === ciudad);
  const pagos = pagosTodos.filter((p) => (p.clientes?.ciudad || 'El Alto') === ciudad);
  const registroMensual = registroTodo.filter((r) => (r.ciudad || 'El Alto') === ciudad);
  const trabajos = (trabajosTodos || []).filter((t) => (t.ciudad || 'El Alto') === ciudad);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JapTom Telecom CRM';
  wb.created = new Date();

  const logoId = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;
  const generado = new Date().toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const base = { ciudad, generado, logoId };

  // ── CLIENTES ──
  const hojaClientes = clientes.map((c) => ({
    ID: c.codigo,
    Cliente: c.nombre,
    Ciudad: c.ciudad || 'El Alto',
    'Teléfono': c.telefono || '',
    'Día de Pago': c.dia_pago ?? '',
    Activo: c.activo ? 'Sí' : 'No',
    Plan: c.plan || '',
    Frecuencia: c.frecuencia || '',
    'Precio en Bs': c.precio || 0,
    Velocidad: c.velocidad || '',
    'Dirección': c.direccion || '',
    Estado: c.activo ? c.estado : 'Inactivo',
    'Factura': c.factura ? 'Sí' : 'No',
    'Último Mensaje Enviado': c.ultimo_mensaje_enviado
      ? new Date(c.ultimo_mensaje_enviado).toLocaleString('es-BO')
      : '',
    'Estado Retiro': c.estado_retiro === 'retirado' ? 'Retirado' : 'Activo',
    'Fecha de Retiro': c.fecha_retiro ? new Date(c.fecha_retiro).toLocaleDateString('es-BO') : '',
    'Equipos Devueltos': c.estado_retiro === 'retirado' ? `${c.equipos_devueltos_count ?? 0}/4` : '',
  }));
  agregarHoja(wb, {
    ...base,
    nombre: 'CLIENTES',
    columnas: [
      { titulo: 'ID' },
      { titulo: 'Cliente' },
      { titulo: 'Ciudad' },
      { titulo: 'Teléfono' },
      { titulo: 'Día de Pago' },
      { titulo: 'Activo' },
      { titulo: 'Plan' },
      { titulo: 'Frecuencia' },
      { titulo: 'Precio en Bs', formato: FORMATO_BS, total: true },
      { titulo: 'Velocidad' },
      { titulo: 'Dirección', ajuste: true },
      { titulo: 'Estado' },
      { titulo: 'Factura' },
      { titulo: 'Último Mensaje Enviado' },
      { titulo: 'Estado Retiro' },
      { titulo: 'Fecha de Retiro' },
      { titulo: 'Equipos Devueltos' },
    ],
    filas: hojaClientes,
    colorear: (titulo, valor) => (titulo === 'Estado' ? COLOR_POR_TEXTO[valor] : null),
  });

  // ── CLIENTES CON FACTURA: los que requieren factura + los que ya tienen
  //    algún pago facturado, con cuánto se les facturó ──
  const factPorCodigo = {};
  pagos.forEach((p) => {
    const codigo = p.clientes?.codigo;
    if (!codigo) return;
    if (!factPorCodigo[codigo]) factPorCodigo[codigo] = { facturados: 0, monto: 0, ultimo: null, sinFactura: 0, porMes: {} };
    const f = factPorCodigo[codigo];
    if (p.con_factura) {
      f.facturados += 1;
      f.monto += Number(p.monto) || 0;
      const mk = mesClave(p.fecha_pago);
      f.porMes[mk] = (f.porMes[mk] || 0) + (Number(p.monto) || 0);
      if (!f.ultimo || new Date(p.fecha_pago) > new Date(f.ultimo)) f.ultimo = p.fecha_pago;
    } else {
      f.sinFactura += 1;
    }
  });

  const clientesFactura = clientes
    .filter((c) => c.factura || (factPorCodigo[c.codigo]?.facturados || 0) > 0)
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

  // Una columna por mes (los últimos 12 con facturación) con el monto facturado
  const mesesFactura = [
    ...new Set(clientesFactura.flatMap((c) => Object.keys(factPorCodigo[c.codigo]?.porMes || {}))),
  ]
    .sort()
    .slice(-12);
  const tituloMesFactura = (mk) => `Facturado ${mesEtiqueta(mk)}`;

  const hojaFactura = clientesFactura
    .map((c) => {
      const f = factPorCodigo[c.codigo] || { facturados: 0, monto: 0, ultimo: null, sinFactura: 0, porMes: {} };
      const filaMeses = {};
      mesesFactura.forEach((mk) => {
        filaMeses[tituloMesFactura(mk)] = f.porMes[mk] || null;
      });
      return {
        ID: c.codigo,
        Cliente: c.nombre,
        NIT: c.nit || '',
        'Teléfono': c.telefono || '',
        Plan: c.plan || '',
        'Precio en Bs': c.precio || 0,
        Estado: c.activo ? c.estado : 'Inactivo',
        'Requiere factura': c.factura ? 'Sí' : 'No',
        'Pagos facturados': f.facturados,
        'Monto facturado (Bs)': f.monto,
        'Último pago facturado': fechaCorta(f.ultimo),
        'Pagos sin factura': c.factura ? f.sinFactura : '—',
        ...filaMeses,
      };
    });
  agregarHoja(wb, {
    ...base,
    nombre: 'CLIENTES CON FACTURA',
    columnas: [
      { titulo: 'ID' },
      { titulo: 'Cliente' },
      { titulo: 'NIT' },
      { titulo: 'Teléfono' },
      { titulo: 'Plan' },
      { titulo: 'Precio en Bs', formato: FORMATO_BS },
      { titulo: 'Estado' },
      { titulo: 'Requiere factura' },
      { titulo: 'Pagos facturados', total: true },
      { titulo: 'Monto facturado (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Último pago facturado' },
      { titulo: 'Pagos sin factura' },
      ...mesesFactura.map((mk) => ({ titulo: tituloMesFactura(mk), formato: FORMATO_BS, total: true })),
    ],
    filas: hojaFactura,
    colorear: (titulo, valor) => (titulo === 'Estado' ? COLOR_POR_TEXTO[valor] : null),
  });

  // ── PAGOS ──
  const hojaPagos = pagos.map((p) => ({
    'ID Cliente': p.clientes?.codigo || '',
    'Fecha de Pago': new Date(p.fecha_pago).toLocaleDateString('es-BO'),
    'Mes de Pago': mesEtiqueta(mesClave(p.fecha_pago)),
    Cliente: p.clientes?.nombre || '',
    Monto: p.monto,
    'Tipo de Pago': p.tipo_pago || 'Mensual',
    'Mes que Corresponde': p.mes_corresponde
      ? new Date(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })
      : '',
    Factura: p.con_factura ? 'Sí' : 'No',
  }));
  agregarHoja(wb, {
    ...base,
    nombre: 'PAGOS',
    columnas: [
      { titulo: 'ID Cliente' },
      { titulo: 'Fecha de Pago' },
      { titulo: 'Mes de Pago' },
      { titulo: 'Cliente' },
      { titulo: 'Monto', formato: FORMATO_BS, total: true },
      { titulo: 'Tipo de Pago' },
      { titulo: 'Mes que Corresponde' },
      { titulo: 'Factura' },
    ],
    filas: hojaPagos,
  });

  // ── TOTALES POR MES: cuánto se cobró, cuánto con factura y trabajos adicionales ──
  const porMes = {};
  const mesFila = (mk) => {
    if (!porMes[mk]) porMes[mk] = { n: 0, cobrado: 0, facturado: 0, sinFactura: 0, trabajos: 0, trabajosFact: 0 };
    return porMes[mk];
  };
  pagos.forEach((p) => {
    const m = mesFila(mesClave(p.fecha_pago));
    const monto = Number(p.monto) || 0;
    m.n += 1;
    m.cobrado += monto;
    if (p.con_factura) m.facturado += monto;
    else m.sinFactura += monto;
  });
  trabajos.forEach((t) => {
    const m = mesFila(mesClave(t.fecha));
    const monto = Number(t.monto) || 0;
    m.trabajos += monto;
    if (t.con_factura) m.trabajosFact += monto;
  });
  const hojaTotalesMes = Object.keys(porMes)
    .sort()
    .map((mk) => {
      const m = porMes[mk];
      return {
        Mes: mesEtiqueta(mk),
        'Pagos (cant.)': m.n,
        'Pagos cobrados (Bs)': m.cobrado,
        'Pagos facturados (Bs)': m.facturado,
        'Pagos sin factura (Bs)': m.sinFactura,
        'Trabajos adicionales (Bs)': m.trabajos,
        'Trabajos facturados (Bs)': m.trabajosFact,
        'Total general (Bs)': m.cobrado + m.trabajos,
      };
    });
  agregarHoja(wb, {
    ...base,
    nombre: 'TOTALES POR MES',
    columnas: [
      { titulo: 'Mes' },
      { titulo: 'Pagos (cant.)', total: true },
      { titulo: 'Pagos cobrados (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Pagos facturados (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Pagos sin factura (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Trabajos adicionales (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Trabajos facturados (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Total general (Bs)', formato: FORMATO_BS, total: true },
    ],
    filas: hojaTotalesMes,
  });

  // ── PLANES ──
  const hojaPlanes = (planes || []).map((p) => ({
    Plan: p.nombre,
    Velocidad: p.velocidad || '',
    Frecuencia: p.frecuencia || '',
    'Precio Bs': p.precio,
  }));
  agregarHoja(wb, {
    ...base,
    nombre: 'PLANES',
    columnas: [
      { titulo: 'Plan' },
      { titulo: 'Velocidad' },
      { titulo: 'Frecuencia' },
      { titulo: 'Precio Bs', formato: FORMATO_BS },
    ],
    filas: hojaPlanes,
  });

  // ── RESUMEN ──
  const activos = clientes.filter((c) => c.activo).length;
  const alDia = clientes.filter((c) => c.activo && c.estado === 'Al día').length;
  const vencidos = clientes.filter((c) => c.activo && c.estado === 'Vencido').length;
  const conFactura = clientes.filter((c) => c.factura).length;
  agregarHoja(wb, {
    ...base,
    nombre: 'RESUMEN',
    columnas: [{ titulo: 'Indicador' }, { titulo: 'Valor' }],
    filas: [
      { Indicador: 'Total Clientes', Valor: clientes.length },
      { Indicador: 'Clientes Activos', Valor: activos },
      { Indicador: 'Clientes Inactivos', Valor: clientes.length - activos },
      { Indicador: 'Clientes al Día', Valor: alDia },
      { Indicador: 'Clientes Vencidos', Valor: vencidos },
      { Indicador: 'Clientes que requieren factura', Valor: conFactura },
    ],
  });

  // ── TRABAJOS ADICIONALES ──
  const hojaTrabajos = trabajos.map((t) => ({
    Fecha: new Date(t.fecha).toLocaleDateString('es-BO'),
    Mes: mesEtiqueta(mesClave(t.fecha)),
    Cliente: t.clientes?.nombre || t.nombre_cliente_externo || '',
    'ID Cliente': t.clientes?.codigo || '',
    Tipo: t.tipo || '',
    'Descripción': t.descripcion || '',
    'Monto (Bs)': t.monto,
    'Costo Materiales (Bs)': t.costo_materiales || 0,
    Factura: t.con_factura ? 'Sí' : 'No',
    NIT: t.nit || '',
  }));
  agregarHoja(wb, {
    ...base,
    nombre: 'TRABAJOS ADICIONALES',
    columnas: [
      { titulo: 'Fecha' },
      { titulo: 'Mes' },
      { titulo: 'Cliente' },
      { titulo: 'ID Cliente' },
      { titulo: 'Tipo' },
      { titulo: 'Descripción', ajuste: true },
      { titulo: 'Monto (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Costo Materiales (Bs)', formato: FORMATO_BS, total: true },
      { titulo: 'Factura' },
      { titulo: 'NIT' },
    ],
    filas: hojaTrabajos,
  });

  // ── RESUMEN MENSUAL: una fila por cliente (ordenado por código), una columna por mes ──
  const clientePorId = {};
  clientes.forEach((c) => (clientePorId[c.id] = c));

  const periodos = [...new Set(registroMensual.map((r) => r.periodo))].sort();

  const porCliente = {};
  registroMensual.forEach((r) => {
    if (!porCliente[r.cliente_id]) {
      const c = clientePorId[r.cliente_id];
      porCliente[r.cliente_id] = {
        Código: c?.codigo || '',
        Cliente: r.nombre,
        meses: {},
      };
    }
    porCliente[r.cliente_id].meses[r.periodo] = ETIQUETA_STATUS[r.status] || r.status;
  });

  const hojaResumenMensual = Object.values(porCliente)
    .sort((a, b) => a.Código.localeCompare(b.Código))
    .map((c) => {
      const fila = { Código: c.Código, Cliente: c.Cliente };
      periodos.forEach((p) => {
        fila[nombreMesCorto(p)] = c.meses[p] || '';
      });
      return fila;
    });
  agregarHoja(wb, {
    ...base,
    nombre: 'RESUMEN MENSUAL',
    columnas: [
      { titulo: 'Código' },
      { titulo: 'Cliente' },
      ...periodos.map((p) => ({ titulo: nombreMesCorto(p) })),
    ],
    filas: hojaResumenMensual,
    colorear: (titulo, valor) => (titulo !== 'Código' && titulo !== 'Cliente' ? COLOR_POR_TEXTO[valor] : null),
  });

  return wb;
}

function descargarArchivo(buffer, nombreArchivo) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Genera y descarga 2 archivos .xlsx separados: uno para El Alto, otro para Tarija.
export async function exportarExcel() {
  const [{ data: clientesTodos }, { data: pagosTodos }, { data: planes }, { data: registroTodo }, { data: trabajosTodos }, logo] = await Promise.all([
    supabase.from('v_clientes_estado').select('*').order('codigo', { ascending: true }),
    supabase
      .from('pagos')
      .select('fecha_pago, monto, tipo_pago, mes_corresponde, con_factura, clientes(codigo, nombre, ciudad)')
      .order('fecha_pago', { ascending: false }),
    supabase.from('planes').select('*').order('precio', { ascending: true }),
    supabase.from('v_registro_pagos_mensual').select('*'),
    supabase
      .from('trabajos_adicionales')
      .select('fecha, tipo, descripcion, monto, costo_materiales, ciudad, con_factura, nit, nombre_cliente_externo, clientes(codigo, nombre)')
      .order('fecha', { ascending: false }),
    cargarLogo(),
  ]);

  const datos = {
    clientesTodos: clientesTodos || [],
    pagosTodos: pagosTodos || [],
    planes: planes || [],
    registroTodo: registroTodo || [],
    trabajosTodos: trabajosTodos || [],
  };

  const fecha = new Date().toISOString().slice(0, 10);

  for (const ciudad of CIUDADES) {
    const wb = await construirLibro(ciudad, datos, { logo });
    const buffer = await wb.xlsx.writeBuffer();
    const sufijo = ciudad.replace(/\s+/g, '');
    descargarArchivo(buffer, `JapTom_CRM_${sufijo}_${fecha}.xlsx`);
    // Pequeña pausa para que el navegador no bloquee la 2da descarga seguida
    await new Promise((r) => setTimeout(r, 500));
  }
}
