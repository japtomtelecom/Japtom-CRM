import { verificarAdmin } from '@/lib/verificarAdmin';
import { obtenerOnusUbiquiti, buscarOnu, reiniciarOnuUbiquiti } from '@/lib/oltUbiquiti';

export const maxDuration = 45;

// Reinicia la ONT de un cliente de El Alto en la OLT Ubiquiti.
// Encuentra la ONU por MAC o IP (igual que /optical) y usa su serial.
export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('nombre, ciudad, ip_asignada, olt_mac')
    .eq('id', clienteId)
    .single();
  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });

  if ((cliente.ciudad || 'El Alto') !== 'El Alto') {
    return Response.json({ error: 'Esta OLT es solo para clientes de El Alto.' }, { status: 400 });
  }
  if (!cliente.ip_asignada && !cliente.olt_mac) {
    return Response.json(
      { error: 'Este cliente no tiene "IP asignada" ni "MAC" cargados en su ficha — al menos uno de los dos hace falta para encontrar su ONU en esta OLT.' },
      { status: 400 }
    );
  }

  try {
    const onus = await obtenerOnusUbiquiti();
    const onu = buscarOnu(onus, { mac: cliente.olt_mac, ip: cliente.ip_asignada });
    if (!onu || !onu.serial) {
      return Response.json(
        { error: `No se encontró la ONU de ${cliente.nombre} en la OLT (MAC ${cliente.olt_mac || '—'} / IP ${cliente.ip_asignada || '—'}).` },
        { status: 404 }
      );
    }

    await reiniciarOnuUbiquiti(onu.serial);

    return Response.json({
      ok: true,
      mensaje: `Se envió el reinicio a la ONT de ${cliente.nombre}. Tarda 1-2 minutos en volver a conectar.`,
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo reiniciar la ONT: ' + e.message }, { status: 502 });
  }
}
