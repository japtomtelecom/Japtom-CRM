import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con la "service role key" — SOLO se usa en el servidor
// (rutas /api), nunca se expone al navegador. Permite verificar el token del
// usuario que hace la petición y consultar su rol real en la base de datos.
function clienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Verifica que la petición traiga un token válido de un usuario con rol admin.
// Devuelve { ok: true, userId } o { ok: false, status, error }.
export async function verificarAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401, error: 'Falta el token de sesión.' };

  const supabaseAdmin = clienteAdmin();
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, error: 'Sesión inválida.' };

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', userData.user.id)
    .single();

  if (perfil?.rol !== 'admin') {
    return { ok: false, status: 403, error: 'Solo un Administrador puede hacer esto.' };
  }

  return { ok: true, userId: userData.user.id, supabaseAdmin };
}
