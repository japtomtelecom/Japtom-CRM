import { verificarAdmin } from '@/lib/verificarAdmin';
import { configOlt } from '@/lib/oltConfig';
import { ejecutarComandosOlt, comandosEnInterfazPon, detectarErrorCli } from '@/lib/oltSsh';

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('nombre, ciudad, olt_puerto_pon, olt_onu_id')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.olt_puerto_pon || !cliente.olt_onu_id) {
    return Response.json(
      { error: 'Este cliente no tiene "Puerto PON" e "ID de ONU" configurados en su ficha.' },
      { status: 400 }
    );
  }

  try {
    const config = configOlt(cliente.ciudad);
    const comandos = comandosEnInterfazPon(cliente.olt_puerto_pon, [
      `onu ${cliente.olt_onu_id} reboot`,
    ]);
    const salida = await ejecutarComandosOlt(config, comandos);

    const errorCli = detectarErrorCli(salida);
    if (errorCli) {
      return Response.json(
        { error: `La OLT respondió con un error: "${errorCli}".`, salidaCruda: salida.slice(-2000) },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, mensaje: `Se envió el reinicio a la ONT de ${cliente.nombre}. Tarda 1-2 minutos en volver a conectar.` });
  } catch (e) {
    return Response.json({ error: 'No se pudo conectar con la OLT: ' + e.message }, { status: 502 });
  }
}
