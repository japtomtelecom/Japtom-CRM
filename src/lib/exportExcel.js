import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

// Genera un .xlsx con la misma estructura que el Excel original (CLIENTES, PAGOS, PLANES, RESUMEN)
// a partir de los datos reales que hoy viven en Supabase.
export async function exportarExcel() {
  const [{ data: clientes }, { data: pagos }, { data: planes }, { data: dashboard }] = await Promise.all([
    supabase.from('v_clientes_estado').select('*').order('nombre', { ascending: true }),
    supabase
      .from('pagos')
      .select('fecha_pago, monto, tipo_pago, mes_corresponde, clientes(codigo, nombre)')
      .order('fecha_pago', { ascending: false }),
    supabase.from('planes').select('*').order('precio', { ascending: true }),
    supabase.from('v_dashboard').select('*').single(),
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

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `JapTom_CRM_${fecha}.xlsx`);
}
