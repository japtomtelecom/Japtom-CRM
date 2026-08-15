import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';
import { leerTraficoConConexion, buscarInterfazPppoeConConexion } from '@/lib/mikrotikTrafico';

// Tráfico en tiempo real (subida/bajada) de la sesión PPPoE activa de un
// cliente puntual. Pensado para que el frontend lo llame cada pocos
// segundos mientras se está viendo la ficha del cliente.
export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('pppoe_usuario, ciudad')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.pppoe_usuario) {
    return Response.json({ error: 'Este cliente no tiene un "Usuario PPPoE" configurado.' }, { status: 400 });
  }

  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({
      host: routerConfig.host,
      user: routerConfig.user,
      password: routerConfig.password,
      port: routerConfig.port,
      timeout: 8,
    });
    await conn.connect();

    const activos = await conn.write('/ppp/active/print', [`?name=${cliente.pppoe_usuario}`]);
    if (!activos.length) {
      conn.close();
      return Response.json({ ok: true, online: false });
    }

    const interfaz = await buscarInterfazPppoeConConexion(conn, cliente.pppoe_usuario);
    if (!interfaz) {
      conn.close();
      return Response.json({ ok: true, online: true, sinInterfaz: true });
    }

    const trafico = await leerTraficoConConexion(conn, interfaz);
    conn.close();

    if (!trafico) return Response.json({ ok: true, online: true, sinInterfaz: true });
    return Response.json({ ok: true, online: true, ...trafico });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
