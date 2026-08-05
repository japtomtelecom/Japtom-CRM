import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

const ETIQUETA_STATUS = {
  pagado: 'Pagado',
  no_vencido: 'Aún no vence',
  por_vencer: 'Vencido (1-5 días)',
  vencido: 'Vencido (+5 días)',
};

function nombreMesCorto(periodo) {
  const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' });
}

// Genera un .xlsx con la misma estructura que el Excel original (CLIENTES, PAGOS, PLANES, RESUMEN)
// más una hoja RESUMEN MENSUAL con una fila por cliente y una columna por mes.
export async function exportarExcel() {
  const [{ data: clientes }, { data: pagos }, { data: planes }, { data: dashboard }, { data: registroMensual }] =
    await Promise.all([
      supabase.from('v_clientes_estado').select('*').order('nombre', { ascending: true }),
      supabase
        .from('pagos')
        .select('fecha_pago, monto, tipo_pago, mes_corresponde, clientes(codigo, nombre, ciudad)')
        .order('fecha_pago', { ascending: false }),
      supabase.from('planes').select('*').order('precio', { ascending: true }),
      supabase.from('v_dashboard').select('*').single(),
      supabase.from('v_registro_pagos_mensual').select('*'),
    ]);

  const wb = XLSX.utils.book_new();

  const hojaClientes = (clientes || []).map((c) => ({
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

  const hojaPagos = (pagos || []).map((p) => ({
    'ID Cliente': p.clientes?.codigo || '',
    'Fecha de Pago': new Date(p.fecha_pago).toLocaleDateString('es-BO'),
    Cliente: p.clientes?.nombre || '',
    Ciudad: p.clientes?.ciudad || '',
    Monto: p.monto,
    'Tipo de Pago': p.tipo_pago || 'Mensual',
    'Mes que Corresponde': p.mes_corresponde
      ? new Date(p.mes_corresponde).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' })
      : '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPagos), 'PAGOS');

  const hojaPlanes = (planes || []).map((p) => ({
    Plan: p.nombre,
    Velocidad: p.velocidad || '',
    Frecuencia: p.frecuencia || '',
    'Precio Bs': p.precio,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaPlanes), 'PLANES');

  if (dashboard) {
    const hojaResumen = [
      { Indicador: 'Total Clientes', Valor: dashboard.total_clientes },
      { Indicador: 'Clientes Activos', Valor: dashboard.clientes_activos },
      { Indicador: 'Clientes Inactivos', Valor: dashboard.clientes_inactivos },
      { Indicador: 'Clientes al Día', Valor: dashboard.clientes_al_dia },
      { Indicador: 'Clientes Vencidos', Valor: dashboard.clientes_vencidos },
      { Indicador: 'Cobrado Mes Actual (Bs)', Valor: dashboard.cobrado_mes_actual },
      { Indicador: 'Ingreso Histórico Total (Bs)', Valor: dashboard.ingreso_historico },
      { Indicador: 'Ticket Promedio por Pago (Bs)', Valor: dashboard.ticket_promedio },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaResumen), 'RESUMEN');
  }

  // --- RESUMEN MENSUAL: una fila por cliente, una columna por mes ---
  const clientePorId = {};
  (clientes || []).forEach((c) => (clientePorId[c.id] = c));

  const periodos = [...new Set((registroMensual || []).map((r) => r.periodo))].sort();

  const porCliente = {};
  (registroMensual || []).forEach((r) => {
    if (!porCliente[r.cliente_id]) {
      const c = clientePorId[r.cliente_id];
      porCliente[r.cliente_id] = {
        Código: c?.codigo || '',
        Cliente: r.nombre,
        Ciudad: r.ciudad || c?.ciudad || '',
        meses: {},
      };
    }
    porCliente[r.cliente_id].meses[r.periodo] = ETIQUETA_STATUS[r.status] || r.status;
  });

  const hojaResumenMensual = Object.values(porCliente)
    .sort((a, b) => (a.Ciudad + a.Cliente).localeCompare(b.Ciudad + b.Cliente))
    .map((c) => {
      const fila = {
        Código: c.Código,
        Cliente: c.Cliente,
        Ciudad: c.Ciudad,
      };
      periodos.forEach((p) => {
        fila[nombreMesCorto(p)] = c.meses[p] || '';
      });
      return fila;
    });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaResumenMensual), 'RESUMEN MENSUAL');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `JapTom_CRM_${fecha}.xlsx`);
}