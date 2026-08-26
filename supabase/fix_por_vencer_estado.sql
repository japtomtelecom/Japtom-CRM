-- ============================================================
-- Feature: nuevo estado "Por vencer" — cliente al que le falta
-- exactamente 1 día para su fecha de corte (dia_pago) de este mes.
--
-- Pedido del usuario: poder avisarle al cliente ANTES de que se
-- venza (recordatorio proactivo), no solo después. Hasta ahora
-- v_clientes_estado era binario: "Al día" / "Vencido". Se agrega
-- un tercer valor sin tocar la lógica ya corregida de esos dos
-- (ver claude/fix-vencido-dia-pago.md del proyecto):
--
--   1. Cliente ya cubierto (pago real o "Marcar al día") hasta el
--      mes actual o más adelante -> "Al día" (sin cambios).
--   2. Sin dia_pago configurado -> criterio viejo, sin cambios
--      ("Al día"/"Vencido" según pago del mes calendario).
--   3. Con dia_pago, y HOY es exactamente el día antes de la fecha
--      de corte de este mes -> "Por vencer" (nuevo).
--   4. Con dia_pago, HOY <= fecha de corte -> "Al día" (sin cambios,
--      salvo que ahora el día -1 lo captura el caso 3 primero).
--   5. Pasada la fecha de corte -> "Vencido" (sin cambios).
--
-- La fecha de corte se calcula una sola vez con un LATERAL join
-- (misma fórmula que ya usaban los otros casos, ajustada a meses
-- cortos con LEAST(dia_pago, días_del_mes)) para no repetirla tres
-- veces en el CASE.
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

    -- 3) Falta exactamente 1 día para la fecha de corte de este mes
    when current_date = fc.fecha_corte - 1 then 'Por vencer'

    -- 4) Con dia_pago: aún no llega (o es hoy) la fecha de corte de este mes
    when current_date <= fc.fecha_corte then 'Al día'

    -- 5) Pasada la fecha de corte
    else 'Vencido'
  end as estado
from clientes c
left join v_pagos_mes_actual pm on pm.cliente_id = c.id
left join v_cobertura_cliente cc on cc.cliente_id = c.id
left join lateral (
  select (
    date_trunc('month', current_date)::date
    + (least(c.dia_pago, extract(day from date_trunc('month', current_date)::date + interval '1 mon -1 days')::integer) - 1) * interval '1 day'
  )::date as fecha_corte
) fc on true;
