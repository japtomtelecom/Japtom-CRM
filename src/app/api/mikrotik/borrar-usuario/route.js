import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';

// Ver nota en crear-usuario/route.js: se sube el límite de tiempo porque
// esta acción hace varios comandos seguidos al MikroTik.
export const maxDuration = 20;

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

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
    conn = new RouterOSAPI({ ...routerConfig, timeout: 15 });
    await conn.connect();

    const secrets = await conn.write('/ppp/secret/print', [`?name=${cliente.pppoe_usuario}`]);
    if (!secrets.length) {
      conn.close();
      return Response.json(
        { error: `No existe un usuario PPPoE llamado "${cliente.pppoe_usuario}" en este MikroTik (puede que ya se haya borrado).` },
        { status: 404 }
      );
    }

    // Si está conectado en este momento, corta la sesión activa primero —
    // si no, seguiría navegando con la config vieja hasta que el equipo
    // del cliente intente reconectar y ya no encuentre el usuario.
    const activos = await conn.write('/ppp/active/print', [`?name=${cliente.pppoe_usuario}`]);
    if (activos.length) {
      await conn.write('/ppp/active/remove', [`=.id=${activos[0]['.id']}`]);
    }

    await conn.write('/ppp/secret/remove', [`=.id=${secrets[0]['.id']}`]);
    conn.close();

    return Response.json({
      ok: true,
      mensaje: `Usuario PPPoE "${cliente.pppoe_usuario}" borrado del MikroTik de ${cliente.ciudad}. (Esto no borra la ficha del cliente en el CRM, solo su configuración en el router.)`,
    });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}
