import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId, activar } = await request.json();
  if (!clienteId || typeof activar !== 'boolean') {
    return Response.json({ error: 'Faltan datos (clienteId, activar).' }, { status: 400 });
  }

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('pppoe_usuario, nombre, ciudad')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.pppoe_usuario) {
    return Response.json(
      { error: 'Este cliente no tiene un "Usuario PPPoE" configurado en su ficha.' },
      { status: 400 }
    );
  }

  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({ ...routerConfig, timeout: 8 });
    await conn.connect();

    const secrets = await conn.write('/ppp/secret/print', [`?name=${cliente.pppoe_usuario}`]);
    if (!secrets.length) {
      throw new Error(`No se encontró el usuario PPPoE "${cliente.pppoe_usuario}" en el MikroTik.`);
    }
    await conn.write('/ppp/secret/set', [`=.id=${secrets[0]['.id']}`, `=disabled=${activar ? 'no' : 'yes'}`]);

    // Si se está cortando el servicio, además desconecta la sesión activa
    // (si no, el cliente seguiría navegando hasta que su router intente reconectar solo).
    if (!activar) {
      const activos = await conn.write('/ppp/active/print', [`?name=${cliente.pppoe_usuario}`]);
      if (activos.length) {
        await conn.write('/ppp/active/remove', [`=.id=${activos[0]['.id']}`]);
      }
    }

    conn.close();
    return Response.json({ ok: true, mensaje: activar ? 'Servicio reactivado.' : 'Servicio cortado.' });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
