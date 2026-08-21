import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';

// Ver nota en crear-usuario/route.js: se sube el límite de tiempo porque
// esta acción hace varios comandos seguidos al MikroTik y a veces superaba
// los 8s que tenía antes, mostrando "Timed out after 8 seconds".
export const maxDuration = 20;

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('pppoe_usuario, plan, nombre, ciudad')
    .eq('id', clienteId)
    .single();

  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (!cliente.pppoe_usuario) {
    return Response.json(
      { error: 'Este cliente no tiene un "Usuario PPPoE" configurado en su ficha.' },
      { status: 400 }
    );
  }

  const { data: planCatalogo } = await auth.supabaseAdmin
    .from('planes')
    .select('perfil_mikrotik')
    .eq('nombre', cliente.plan)
    .single();

  const perfil = planCatalogo?.perfil_mikrotik;
  if (!perfil) {
    return Response.json(
      { error: `El plan "${cliente.plan}" no tiene un "Perfil MikroTik" configurado en Planes.` },
      { status: 400 }
    );
  }

  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({ ...routerConfig, timeout: 15 });
    await conn.connect();

    const secrets = await conn.write('/ppp/secret/print', [`?name=${cliente.pppoe_usuario}`]);
    if (!secrets.length) {
      throw new Error(`No se encontró el usuario PPPoE "${cliente.pppoe_usuario}" en el MikroTik.`);
    }
    await conn.write('/ppp/secret/set', [`=.id=${secrets[0]['.id']}`, `=profile=${perfil}`]);

    // Si el cliente está conectado en este momento, se le corta la sesión para
    // que el nuevo perfil (velocidad) se aplique de inmediato en su próxima conexión.
    const activos = await conn.write('/ppp/active/print', [`?name=${cliente.pppoe_usuario}`]);
    if (activos.length) {
      await conn.write('/ppp/active/remove', [`=.id=${activos[0]['.id']}`]);
    }

    conn.close();
    return Response.json({ ok: true, mensaje: `Perfil actualizado a "${perfil}" en el MikroTik.` });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
