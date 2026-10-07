// src/app/api/olt-btpon/reboot/route.js
//
// Reinicia la ONT de UN cliente en la OLT BTPON, usando su "Puerto PON" e
// "ID de ONU" guardados en su ficha. Igual que la web de la OLT, no permite
// reiniciar una ONU que esté offline. Requiere admin.

import { verificarAdmin } from "@/lib/verificarAdmin";
import { obtenerEstadoOnu, reiniciarOnuBtpon } from "@/lib/oltBtpon";

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
      return Response.json(
        { error: `No se encontró la ONU ${cliente.olt_onu_id} en el puerto ${cliente.olt_puerto_pon}. Revisa los datos de la ficha.` },
        { status: 404 }
      );
    }
    if (String(onu.status || "").toLowerCase() !== "online") {
      return Response.json(
        { error: `La ONT de ${cliente.nombre} está offline: no se puede reiniciar remotamente.` },
        { status: 409 }
      );
    }

    await reiniciarOnuBtpon(cliente.olt_puerto_pon, cliente.olt_onu_id);

    return Response.json({
      ok: true,
      mensaje: `Se envió el reinicio a la ONT de ${cliente.nombre}. Tarda 1-2 minutos en volver a conectar.`,
    });
  } catch (e) {
    console.error("Error reiniciando ONT en OLT BTPON:", e);
    return Response.json({ error: "No se pudo reiniciar la ONT: " + e.message }, { status: 502 });
  }
}
