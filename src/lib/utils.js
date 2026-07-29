// Utilidades compartidas: formato de moneda, teléfono y mensajes de WhatsApp

// Convierte un valor de fecha (yyyy-mm-dd, como vienen las columnas `date`
// de Postgres) en un Date de medianoche LOCAL, evitando el bug clásico de
// que new Date("2026-07-01") se interprete como UTC y al mostrarla en la
// hora de Bolivia se corra un día hacia atrás (mostrando el mes anterior).
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
  // Toma solo el primer número si hay varios separados por / o -
  const primero = String(telefono).split(/[\/\-]/)[0].trim().replace(/\D/g, '');
  if (!primero) return null;
  // Si ya tiene código de país boliviano (591) lo deja, si no, se lo antepone
  if (primero.startsWith('591') && primero.length > 8) return primero;
  return `591${primero}`;
}

export function linkWhatsApp(telefono, mensaje) {
  const limpio = limpiarTelefono(telefono);
  if (!limpio) return null;
  return `https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`;
}

// Reconstruye el mensaje según el estado del cliente, igual que las plantillas del Excel original
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
      .replaceAll('{plan}', cliente.plan || 'de Internet');
  }
  return (plantillas.mensaje_recordatorio || '')
    .replaceAll('{nombre}', cliente.nombre)
    .replaceAll('{codigo}', cliente.codigo)
    .replaceAll('{precio}', cliente.precio || '')
    .replaceAll('{dia_pago}', cliente.dia_pago ?? '')
    .replaceAll('{empresa}', empresaNombre || 'Japtom-Telecom');
}

export function nombreMes(fecha) {
  return new Date(fecha).toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
}
