// src/app/api/olt-btpon/estado/route.js
//
// Consulta el estado y la potencia óptica de la ONU de UN cliente puntual
// en la OLT BTPON, usando su "Puerto PON" e "ID de ONU" guardados en su
// ficha (Supabase). Requiere admin (mismo patrón que src/app/api/olt/...
// para V-Sol).

import { verificarAdmin } from "@/lib/verificarAdmin";
import { obtenerEstadoOnu, obtenerOpticaOnu } from "@/lib/oltBtpon";

export async function POST(request) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { clienteId } = await request.json();
  if (!clienteId) return Response.json({ error: "Falta clienteId." }, { status: 400 });

  const { data: cliente, error: errCliente } = await auth.supabaseAdmin
    .from("clientes")
    .select("nombre, olt_puerto_pon, olt_onu_id")
    .eq("id", clienteId)
    .single();

  if (errCliente || !cliente) {
    return Response.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  if (!cliente.olt_puerto_pon || !cliente.olt_onu_id) {
    return Response.json(
      { error: 'Este cliente no tiene "Puerto PON" e "ID de ONU" configurados en su ficha.' },
      { status: 400 }
    );
  }

  try {
    const onu = await obtenerEstadoOnu(cliente.olt_puerto_pon, cliente.olt_onu_id);

    if (!onu) {
      return Response.json({
        ok: true,
        encontrado: false,
        mensaje: `No se encontró la ONU ${cliente.olt_onu_id} en el puerto ${cliente.olt_puerto_pon}. Revisa que los datos de la ficha sean correctos.`,
      });
    }

    // La potencia óptica es un dato "extra" — si falla, igual devolvemos
    // el estado básico (online/offline) en vez de romper todo.
    let optica = null;
    try {
      optica = await obtenerOpticaOnu(cliente.olt_puerto_pon, cliente.olt_onu_id);
    } catch (e) {
      console.error("No se pudo obtener la potencia óptica:", e);
    }

    return Response.json({
      ok: true,
      encontrado: true,
      onu_name: onu.onu_name,
      macaddr: onu.macaddr,
      status: onu.status,
      auth_state: onu.auth_state,
      register_time: onu.register_time,
      ...(optica || {}),
    });
  } catch (e) {
    return Response.json({ error: "No se pudo conectar con la OLT: " + e.message }, { status: 502 });
  }
}
