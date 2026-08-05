import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

function nombreMesCorto(periodo) {
  const d = new Date(periodo.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
}

// Genera un .xlsx con la misma estructura que el Excel original (CLIENTES, PAGOS, PLANES, RESUMEN)
// más una hoja nueva RESUMEN MENSUAL, desglosada por ciudad.
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

  // --- RESUMEN MENSUAL por ciudad ---
  // Agrupa el registro mensual (estado por cliente/mes) por ciudad + periodo
  const grupos = {};
  (registroMensual || []).forEach((r) => {
    const ciudad = r.ciudad || 'Sin ciudad';
    const clave = `${ciudad}|${r.periodo}`;
    if (!grupos[clave]) {
      grupos[clave] = {
        ciudad,
        periodo: r.periodo,
        total: 0,
        pagados: 0,
        no_vencido: 0,
        por_vencer: 0,
        vencido: 0,
      };
    }
    grupos[clave].total += 1;
    if (r.status === 'pagado') grupos[clave].pagados += 1;
    if (r.status === 'no_vencido') grupos[clave].no_vencido += 1;
    if (r.status === 'por_vencer') grupos[clave].por_vencer += 1;
    if (r.status === 'vencido') grupos[clave].vencido += 1;
  });

  // Suma de monto cobrado por ciudad + mes (a partir de los pagos reales)
  const montoPorClave = {};
  (pagos || []).forEach((p) => {
    if (!p.mes_corresponde || !p.clientes?.ciudad) return;
    const clave = `${p.clientes.ciudad}|${p.mes_corresponde}`;
    montoPorClave[clave] = (montoPorClave[clave] || 0) + Number(p.monto || 0);
  });

  const hojaResumenMensual = Object.values(grupos)
    .sort((a, b) => (a.ciudad + a.periodo).localeCompare(b.ciudad + b.periodo))
    .map((g) => {
      const clave = `${g.ciudad}|${g.periodo}`;
      const pendientes = g.no_vencido + g.por_vencer + g.vencido;
      return {
        Ciudad: g.ciudad,
        Mes: nombreMesCorto(g.periodo),
        'Total Clientes': g.total,
        Pagados: g.pagados,
        'Aún no vence': g.no_vencido,
        'Vencido (1-5 días)': g.por_vencer,
        'Vencido (+5 días)': g.vencido,
        'Total Pendientes': pendientes,
        '% Al Día': g.total > 0 ? `${Math.round((g.pagados / g.total) * 100)}%` : '0%',
        'Monto Cobrado (Bs)': montoPorClave[clave] || 0,
      };
    });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaResumenMensual), 'RESUMEN MENSUAL');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `JapTom_CRM_${fecha}.xlsx`);
}