import { RouterOSAPI } from 'node-routeros';
import { verificarAdmin } from '@/lib/verificarAdmin';
import { configMikrotik } from '@/lib/mikrotikConfig';

// "Bloquear servicio" y otras acciones hacen varios comandos seguidos al
// MikroTik (buscar, modificar, a veces cortar sesión activa) y a veces
// tardaban más de los 8s que tenía el timeout de conexión, mostrando
// "Timed out after 8 seconds" y funcionando recién al 2do/3er intento.
// Se sube el límite de Vercel (por defecto más corto) y el de la conexión
// al router, dejando margen entre ambos.
export const maxDuration = 20;

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: 'Falta clienteId.' }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from('clientes')
    .select('codigo, pppoe_usuario, pppoe_password, plan, nombre, ciudad, activo, ip_asignada')
    .eq('id', clienteId)
    .single();
  if (errCliente || !cliente) return Response.json({ error: 'Cliente no encontrado.' }, { status: 404 });

  if (!cliente.pppoe_usuario || !cliente.pppoe_password) {
    return Response.json(
      { error: 'Este cliente necesita "Usuario PPPoE" y "Contraseña PPPoE" completos en su ficha antes de crearlo en el MikroTik.' },
      { status: 400 }
    );
  }

  const { data: planCatalogo } = await auth.supabaseAdmin
    .from('planes')
    .select('perfil_mikrotik')
    .eq('nombre', cliente.plan)
    .single();

  // Antes, si no había match de plan (o el plan no tenía "Perfil MikroTik"
  // cargado en Planes), este endpoint creaba igual el usuario PPPoE pero
  // SIN el parámetro =profile=, y el MikroTik lo asignaba en silencio al
  // perfil "default" — sin avisar. Ahora se corta antes de conectar al
  // router, igual que ya hacía /api/mikrotik/cambiar-plan.
  if (!cliente.plan) {
    return Response.json(
      { error: 'Este cliente no tiene un "Plan" asignado en su ficha.' },
      { status: 400 }
    );
  }
  if (!planCatalogo?.perfil_mikrotik) {
    return Response.json(
      {
        error: `El plan "${cliente.plan}" no tiene un "Perfil MikroTik" configurado en Planes (o el nombre no coincide exactamente con el catálogo). Corrígelo en Planes antes de crear el usuario, o el MikroTik lo va a asignar al perfil "default".`,
      },
      { status: 400 }
    );
  }

  let conn;
  try {
    const routerConfig = configMikrotik(cliente.ciudad);
    conn = new RouterOSAPI({ ...routerConfig, timeout: 15 });
    await conn.connect();

    const existentes = await conn.write('/ppp/secret/print', [`?name=${cliente.pppoe_usuario}`]);
    if (existentes.length) {
      conn.close();
      return Response.json(
        { error: `Ya existe un usuario PPPoE llamado "${cliente.pppoe_usuario}" en este MikroTik.` },
        { status: 409 }
      );
    }

    const params = [
      `=name=${cliente.pppoe_usuario}`,
      `=password=${cliente.pppoe_password}`,
      '=service=pppoe',
      `=disabled=${cliente.activo ? 'no' : 'yes'}`,
      `=comment=${cliente.nombre} (${cliente.codigo})`,
      `=profile=${planCatalogo.perfil_mikrotik}`,
    ];
    if (cliente.ip_asignada) {
      params.push(`=remote-address=${cliente.ip_asignada}`);
    }

    await conn.write('/ppp/secret/add', params);
    conn.close();

    return Response.json({
      ok: true,
      mensaje: `Usuario PPPoE "${cliente.pppoe_usuario}" creado en el MikroTik de ${cliente.ciudad}${
        cliente.ip_asignada ? ` con IP ${cliente.ip_asignada}` : ''
      }.`,
    });
  } catch (e) {
    if (conn) try { conn.close(); } catch {}
    return Response.json({ error: 'No se pudo conectar con el MikroTik: ' + e.message }, { status: 502 });
  }
}