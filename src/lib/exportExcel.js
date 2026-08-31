import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

const ETIQUETA_STATUS = {
  pagado: 'Pagado',
  no_vencido: 'Aún no vence',
  por_vencer: 'Vencido (1-5 días)',
  vencido: 'Vencido (+5 días)',
};

export const CIUDADES = ['El Alto', 'Tarija'];

function nombreMesCorto(periodo) {
  const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}

// Exportado para reutilizarlo desde el respaldo automático semanal
// (src/app/api/cron/respaldo-semanal/route.js) — misma lógica que el botón
// manual "⬇️ Excel" de Configuración, sin duplicar código.
export function construirLibro(ciudad, { clientesTodos, pagosTodos, planes, registroTodo, trabajosTodos }) {
  const clientes = clientesTodos.filter((c) => (c.ciudad || 'El Alto') === ciudad);
  const pagos = pagosTodos.filter((p) => (p.clientes?.ciudad || 'El Alto') === ciudad);
  const registroMensual = registroTodo.filter((r) => (r.ciudad || 'El Alto') === ciudad);
  const trabajos = (trabajosTodos || []).filter((t) => (t.ciudad || 'El Alto') === ciudad);

  const wb = XLSX.utils.book_new();

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
    'Último Mensaje Enviado': c.ultimo_mensaje_enviado
      ? new Date(c.ultimo_mensaje_enviado).toLocaleString('es-BO')
      : '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaClientes), 'CLIENTES');

  const hojaPagos = pagos.map((p) => ({
    'ID Cliente': p.clientes?.codigo || '',
    'Fecha de Pago': new Date(p.fecha_pago).toLocaleDateString('es-BO'),
    Cliente: p.clientes?.nombre || '',
    Monto: p.monto,
    'Tipo de Pago': p.tipo_pago || 'Mensual',
    'Mes que Corresponde': p.mes_corresponde
      ? new Date(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })
      : '',
    Factura: p.con_factura ? 'Sí' : 'No',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPagos), 'PAGOS');

  const hojaPlanes = (planes || []).map((p) => ({
    Plan: p.nombre,
    Velocidad: p.velocidad || '',
    Frecuencia: p.frecuencia || '',
    'Precio Bs': p.precio,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPlanes), 'PLANES');

  const activos = clientes.filter((c) => c.activo).length;
  const alDia = clientes.filter((c) => c.activo && c.estado === 'Al día').length;
  const vencidos = clientes.filter((c) => c.activo && c.estado === 'Vencido').length;
  const hojaResumen = [
    { Indicador: 'Total Clientes', Valor: clientes.length },
    { Indicador: 'Clientes Activos', Valor: activos },
    { Indicador: 'Clientes Inactivos', Valor: clientes.length - activos },
    { Indicador: 'Clientes al Día', Valor: alDia },
    { Indicador: 'Clientes Vencidos', Valor: vencidos },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaResumen), 'RESUMEN');

  const hojaTrabajos = trabajos.map((t) => ({
    Fecha: new Date(t.fecha).toLocaleDateString('es-BO'),
    Cliente: t.clientes?.nombre || t.nombre_cliente_externo || '',
    'ID Cliente': t.clientes?.codigo || '',
    Tipo: t.tipo || '',
    'Descripción': t.descripcion || '',
    'Monto (Bs)': t.monto,
    'Costo Materiales (Bs)': t.costo_materiales || 0,
    Factura: t.con_factura ? 'Sí' : 'No',
    NIT: t.nit || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaTrabajos), 'TRABAJOS ADICIONALES');

  // RESUMEN MENSUAL: una fila por cliente (ordenado por código), una columna por mes
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

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaResumenMensual), 'RESUMEN MENSUAL');

  return wb;
}

// Genera y descarga 2 archivos .xlsx separados: uno para El Alto, otro para Tarija.
export async function exportarExcel() {
  const [{ data: clientesTodos }, { data: pagosTodos }, { data: planes }, { data: registroTodo }, { data: trabajosTodos }] = await Promise.all([
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
    const wb = construirLibro(ciudad, datos);
    const sufijo = ciudad.replace(/\s+/g, '');
    XLSX.writeFile(wb, `JapTom_CRM_${sufijo}_${fecha}.xlsx`);
  }
}