import { verificarAdmin } from '@/lib/verificarAdmin';
import { configOlt } from '@/lib/oltConfig';
import {
  ejecutarComandosOlt,
  comandosEnInterfazPon,
  parseOpticalInfo,
  parseOnuState,
  evaluarRx,
  detectarErrorCli,
} from '@/lib/oltSsh';

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
    const comandos = comandosEnInterfazPon(
      cliente.olt_puerto_pon,
      [`show onu ${cliente.olt_onu_id} optical_info`, `show onu state ${cliente.olt_onu_id}`],
      config.enablePassword
    );
    const salida = await ejecutarComandosOlt(config, comandos);

    const errorCli = detectarErrorCli(salida);
    const optico = parseOpticalInfo(salida);
    const estado = parseOnuState(salida);

    if (errorCli && optico.rxDbm === null && !estado.encontrado) {
      return Response.json(
        {
          error: `La OLT respondió con un error: "${errorCli}". Revisa que el Puerto PON y el ID de ONU sean correctos.`,
          salidaCruda: salida.slice(-2000),
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      ...optico,
      nivelRx: evaluarRx(optico.rxDbm),
      ...estado,
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo conectar con la OLT: ' + e.message }, { status: 502 });
  }
}
