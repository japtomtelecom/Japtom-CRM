-- ============================================================
-- Fix: "Vencido"/"Al día" debe regirse por día de pago (dia_pago) +
-- días de gracia, no por si se recibió un pago dentro del mes
-- calendario actual. Servicio pre-pago: los clientes suelen pagar
-- tarde, así que el ciclo se cuenta desde el día/mes que corresponde,
-- no desde cuándo pagaron.
--
-- Antes: v_clientes_estado solo miraba si "pagado_mes_actual >= precio"
-- dentro del mes calendario en curso. Esto ignoraba por completo:
--   - fecha_vencimiento_manual (por eso "Marcar al día" no hacía nada)
--   - el día de pago real del cliente (dia_pago)
--   - meses ya cubiertos por pagos adelantados/semestrales/anuales
--
-- Ahora: reusa exactamente la misma lógica que ya usa el detalle
-- mensual (el botón 📅 en Clientes, que sale de v_registro_pagos_mensual
-- y v_cobertura_cliente), aplicada al mes actual:
--   1. Si el cliente ya está cubierto (por pagos o por "Marcar al día")
--      hasta el mes en curso o más adelante -> "Al día".
--   2. Si no tiene dia_pago configurado -> se usa el criterio viejo
--      como respaldo (pago recibido este mes calendario).
--   3. Si tiene dia_pago -> "Al día" mientras no se haya pasado la
--      fecha de corte de este mes (ajustada a meses cortos, ej.
--      dia_pago=31 en febrero corta el 28).
--   4. Pasada esa fecha -> "Vencido" (esto junta lo que el detalle
--      mensual separa en "por vencer 1-5 días" y "vencido +5 días";
--      el aviso principal es binario: Al día / Vencido).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace view v_clientes_estado as
select
  c.*,
  coalesce(pm.total, 0) as pagado_mes_actual,
  case
    -- 1) Ya cubierto (por pagos o por "Marcar al día") al menos hasta el mes actual
    when nullif(
           greatest(coalesce(cc.cubierto_hasta, date '0001-01-01'), coalesce(c.fecha_vencimiento_manual, date '0001-01-01')),
           date '0001-01-01'
         ) is not null
         and date_trunc('month', current_date)::date <= date_trunc(
           'month',
           nullif(
             greatest(coalesce(cc.cubierto_hasta, date '0001-01-01'), coalesce(c.fecha_vencimiento_manual, date '0001-01-01')),
             date '0001-01-01'
           )
         )::date
    then 'Al día'

    -- 2) Sin dia_pago configurado: respaldo con el criterio anterior
    when c.dia_pago is null then
      case when coalesce(pm.total, 0) >= c.precio and c.precio > 0 then 'Al día' else 'Vencido' end

    -- 3) Con dia_pago: aún no llega la fecha de corte de este mes
    when current_date <= (
           date_trunc('month', current_date)::date
           + (least(c.dia_pago, extract(day from date_trunc('month', current_date)::date + interval '1 mon -1 days')::integer) - 1) * interval '1 day'
         )::date
    then 'Al día'

    -- 4) Pasada la fecha de corte
    else 'Vencido'
  end as estado
from clientes c
left join v_pagos_mes_actual pm on pm.cliente_id = c.id
left join v_cobertura_cliente cc on cc.cliente_id = c.id;
