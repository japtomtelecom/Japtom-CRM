import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';
import { leerTraficoConConexion } from '@/lib/mikrotikTrafico';

// Tráfico de cada enlace de internet configurado para una sede, cuando hay
// más de uno (ej. El Alto: COMTECO + ENTEL). Se reutilizan las mismas
// credenciales de MIKROTIK_<SEDE>_* que ya usan las demás acciones — no es
// un router aparte, solo se leen otras interfaces del mismo equipo.
export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { ciudad } = await request.json();
  if (!ciudad) return Response.json({ error: 'Falta ciudad.' }, { status: 400 });

  let conn;
  try {
    const routerConfig = configMikrotik(ciudad);
    if (!routerConfig.enlaces.length) {
      const prefijo = ciudad === 'Tarija' ? 'MIKROTIK_TARIJA' : 'MIKROTIK_ELALTO';
      return Response.json(
        {
          error: `No hay enlaces configurados para "${ciudad}". Definí ${prefijo}_ENLACES en Vercel, ej: "COMTECO:sfp-sfpplus1 COMTECO 1,ENTEL:sfp-sfpplus5. Entel Pampahasi".`,
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

    try {
      await conn.connect();
    } catch (e) {
      throw new Error('No se pudo conectar: ' + e.message);
    }

    // Se leen los enlaces uno por uno, reutilizando la misma conexión ya
    // abierta (evita reconectar por cada uno).
    const resultados = [];
    for (const enlace of routerConfig.enlaces) {
      try {
        const trafico = await leerTraficoConConexion(conn, enlace.interfaz);
        resultados.push({
          nombre: enlace.nombre,
          interfaz: enlace.interfaz,
          rxBps: trafico?.rxBps ?? 0,
          txBps: trafico?.txBps ?? 0,
          encontrada: !!trafico,
        });
      } catch (e) {
        resultados.push({ nombre: enlace.nombre, interfaz: enlace.interfaz, error: e.message, encontrada: false });
      }
    }

    conn.close();
    return Response.json({ ok: true, enlaces: resultados });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
