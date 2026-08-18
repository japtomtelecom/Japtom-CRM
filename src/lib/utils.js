// Utilidades compartidas: formato de moneda, teléfono y mensajes de WhatsApp
export function parsearFechaLocal(fecha) {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function formatBs(valor) {
  const n = Number(valor || 0);
  return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
export function limpiarTelefono(telefono) {
  if (!telefono) return null;
  const primero = String(telefono).split(/[\/\-]/)[0].trim().replace(/\D/g, '');
  if (!primero) return null;
  if (primero.startsWith('591') && primero.length > 8) return primero;
  return `591${primero}`;
}
export function linkWhatsApp(telefono, mensaje) {
  const limpio = limpiarTelefono(telefono);
  if (!limpio) return null;
  return `https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`;
}
export function construirMensaje(cliente, plantillas, empresaNombre) {
  if (!cliente.activo) {
    return (plantillas.mensaje_inactivo || '')
      .replaceAll('{nombre}', cliente.nombre)
      .replaceAll('{codigo}', cliente.codigo)
      .replaceAll('{empresa}', empresaNombre || 'Japtom-Telecom');
  }
  if (cliente.estado === 'Al día') {
    return (plantillas.mensaje_al_dia || '')
      .replaceAll('{nombre}', cliente.nombre)
      .replaceAll('{plan}', cliente.plan || 'de Internet')
      .replaceAll('{empresa}', empresaNombre || 'Japtom-Telecom');
  }
  return (plantillas.mensaje_recordatorio || '')
    .replaceAll('{nombre}', cliente.nombre)
    .replaceAll('{codigo}', cliente.codigo)
    .replaceAll('{precio}', cliente.precio || '')
    .replaceAll('{dia_pago}', cliente.dia_pago ?? '')
    .replaceAll('{empresa}', empresaNombre || 'Japtom-Telecom');
}
export function construirMensajeCorte(cliente, plantillas, empresaNombre) {
  return (plantillas.mensaje_corte || '')
    .replaceAll('{nombre}', cliente.nombre)
    .replaceAll('{codigo}', cliente.codigo)
    .replaceAll('{precio}', cliente.precio || '')
    .replaceAll('{dia_pago}', cliente.dia_pago ?? '')
    .replaceAll('{plan}', cliente.plan || 'de Internet')
    .replaceAll('{empresa}', empresaNombre || 'Japtom-Telecom');
}
export function nombreMes(fecha) {
  return new Date(fecha).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
}