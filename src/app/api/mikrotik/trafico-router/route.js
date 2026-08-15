import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';
import { leerTraficoConConexion } from '@/lib/mikrotikTrafico';

// Tráfico total de la interfaz WAN del MikroTik de una sede (subida/bajada
// en bits por segundo, en el momento de la consulta). Pensado para que el
// frontend lo llame cada pocos segundos y arme un gráfico en vivo.
export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { ciudad } = await request.json();
  if (!ciudad) return Response.json({ error: 'Falta ciudad.' }, { status: 400 });

  let conn;
  try {
    const routerConfig = configMikrotik(ciudad);
    if (!routerConfig.wanIface) {
      const prefijo = ciudad === 'Tarija' ? 'MIKROTIK_TARIJA' : 'MIKROTIK_ELALTO';
      return Response.json(
        {
          error: `No hay una interfaz WAN configurada para "${ciudad}". Definí la variable ${prefijo}_WAN_IFACE en Vercel con el nombre exacto de la interfaz de internet (tal cual aparece en Winbox → Interfaces).`,
        },
        { status: 400 }
      );
    }

    conn = new RouterOSAPI({
      host: routerConfig.host,
      user: routerConfig.user,
      password: routerConfig.password,
      port: routerConfig.port,
      timeout: 8,
    });
    await conn.connect();

    const trafico = await leerTraficoConConexion(conn, routerConfig.wanIface);
    conn.close();

    if (!trafico) {
      return Response.json(
        { error: `No se encontró la interfaz "${routerConfig.wanIface}" en el MikroTik de ${ciudad}.` },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, interfaz: routerConfig.wanIface, ...trafico });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
