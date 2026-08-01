import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('codigo, pppoe_usuario, nombre, ciudad')
    .eq('id', clienteId)
    .single();
  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });

  if (!cliente.pppoe_usuario) {
    return Response.json({ error: 'Este cliente no tiene un Usuario PPPoE configurado.' }, { status: 400 });
  }

  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({ ...routerConfig, timeout: 8 });
    await conn.connect();

    const activos = await conn.write('/ppp/active/print', [`?name=${cliente.pppoe_usuario}`]);
    if (!activos.length) {
      conn.close();
      return Response.json(
        { error: `"${cliente.pppoe_usuario}" no tiene una sesión activa en este momento.` },
        { status: 404 }
      );
    }

    for (const sesion of activos) {
      await conn.write('/ppp/active/remove', [`=.id=${sesion['.id']}`]);
    }

    conn.close();
    return Response.json({
      ok: true,
      mensaje: `Sesión activa de "${cliente.pppoe_usuario}" cerrada en el MikroTik de ${cliente.ciudad}.`,
    });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}