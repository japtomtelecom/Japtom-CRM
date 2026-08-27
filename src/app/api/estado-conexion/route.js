import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';
import { msDesdeUptimeRouteros } from '@/lib/mikrotikTrafico';
import { configOlt } from '@/lib/oltConfig';
import {
  ejecutarComandosOlt,
  comandosEnInterfazPon,
  parseOnuState,
  parseOpticalInfo,
  evaluarRx,
  detectarErrorCli,
} from '@/lib/oltSsh';

// Estado de conexión "en vivo" de un cliente puntual, para el botón
// "Ver estado de conexión" de la ficha:
//   - PPPoE (MikroTik): en las dos sedes (Tarija y El Alto).
//   - OLT (V-Sol): solo Tarija por ahora — la OLT de El Alto (BT-PON) todavía
//     no está integrada al CRM (ver claude/estado-integracion-olt.md).
//
// Cada consulta también actualiza `estado_pppoe` (ver
// supabase/estado_pppoe_migracion.sql) para poder mostrar "desde hace
// cuánto" está desconectado, incluso si nadie miró la ficha justo cuando se
// desconectó — entre esto y el cron de src/app/api/cron/estado-pppoe/, el
// historial se mantiene razonablemente al día.
export const maxDuration = 20;

async function actualizarHistorialPppoe(supabaseAdmin, clienteId, conectado) {
  const ahora = new Date().toISOString();

  const { data: previo } = await supabaseAdmin
    .from('estado_pppoe')
    .select('conectado, cambio_en')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  // Si el estado no cambió desde la última vez que se revisó, se conserva
  // la fecha de cambio original (si no, "desde hace" se reiniciaría cada
  // vez que alguien abre la ficha).
  const cambioEn = previo && previo.conectado === conectado ? previo.cambio_en : ahora;

  await supabaseAdmin
    .from('estado_pppoe')
    .upsert({ cliente_id: clienteId, conectado, cambio_en: cambioEn, revisado_en: ahora });

  return cambioEn;
}

async function consultarPppoe(supabaseAdmin, cliente, clienteId) {
  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({ ...routerConfig, timeout: 8 });
    await conn.connect();

    const activos = await conn.write('/ppp/active/print', [
      `?name=${cliente.pppoe_usuario}`,
      '=.proplist=name,uptime',
    ]);
    conn.close();

    const online = activos.length > 0;
    const desde = await actualizarHistorialPppoe(supabaseAdmin, clienteId, online);

    // Si está conectado, RouterOS ya sabe hace cuánto exactamente (campo
    // "uptime" de la sesión activa, ej. "3h25m10s") — es más preciso que
    // nuestro propio historial (que depende de cada cuánto se revisa), así
    // que se usa ese para calcular la hora exacta de conexión. El
    // historial (`desde`) solo hace falta para el caso "desconectado", que
    // el MikroTik no recuerda una vez que la sesión ya no está activa.
    let conectadoDesde = null;
    if (online) {
      const ms = msDesdeUptimeRouteros(activos[0].uptime);
      if (ms !== null) conectadoDesde = new Date(Date.now() - ms).toISOString();
    }

    return { online, desde, conectadoDesde };
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return { error: 'No se pudo conectar con el MikroTik: ' + e.message };
  }
}

async function consultarOlt(cliente) {
  if (!cliente.olt_puerto_pon || !cliente.olt_onu_id) {
    return { error: 'Este cliente no tiene "Puerto PON" e "ID de ONU" configurados en su ficha.' };
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
      return { error: `La OLT respondió con un error: "${errorCli}".` };
    }
    return { ...optico, nivelRx: evaluarRx(optico.rxDbm), ...estado };
  } catch (e) {
    return { error: 'No se pudo conectar con la OLT: ' + e.message };
  }
}

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('nombre, pppoe_usuario, ciudad, olt_puerto_pon, olt_onu_id')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.pppoe_usuario) {
    return Response.json(
      { error: 'Este cliente no tiene un "Usuario PPPoE" configurado en su ficha.' },
      { status: 400 }
    );
  }

  const esTarija = cliente.ciudad === 'Tarija';

  const [pppoe, olt] = await Promise.all([
    consultarPppoe(auth.supabaseAdmin, cliente, clienteId),
    // En El Alto la OLT todavía no está integrada — no tiene sentido
    // intentar conectarse, así que ni se consulta.
    esTarija ? consultarOlt(cliente) : Promise.resolve(null),
  ]);

  return Response.json({ ok: true, ciudad: cliente.ciudad, pppoe, olt });
}
