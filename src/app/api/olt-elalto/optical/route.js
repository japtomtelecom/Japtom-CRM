import { verificarAdmin } from '@/lib/verificarAdmin';
import { obtenerOnusUbiquiti, buscarOnu } from '@/lib/oltUbiquiti';

export const maxDuration = 25;

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('nombre, codigo, ciudad, ip_asignada, olt_mac')
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
    if (!onu) {
      return Response.json({
        encontrado: false,
        mensaje: `No se encontró ninguna ONU con esos datos (MAC ${cliente.olt_mac || '—'} / IP ${cliente.ip_asignada || '—'}) en esta OLT.`,
      });
    }
    return Response.json({
      encontrado: true,
      online: !!onu.connected,
      autorizada: !!onu.authorized,
      rxDbm: onu.rxPower ?? null,
      txDbm: onu.txPower ?? null,
      temperaturaC: onu.system?.temperature?.cpu ?? null,
      puertoPon: onu.oltPort ?? null,
      serial: onu.serial ?? null,
      mac: onu.mac ?? null,
      distanciaM: onu.distance ?? null,
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo consultar la OLT: ' + e.message }, { status: 502 });
  }
}