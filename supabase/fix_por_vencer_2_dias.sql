-- ============================================================
-- Feature: ampliar la ventana de "Por vencer" de 1 a 2 días antes
-- de la fecha de corte — 26/08/2026
--
-- Pedido del usuario: que el aviso "Por vencer" (ver
-- fix_por_vencer_estado.sql, mismo día) no aparezca solo el día
-- antes del vencimiento, sino también 2 días antes. Se eligió
-- ampliar la ventana del mismo estado (no crear un estado aparte
-- para "2 días").
--
-- Único cambio real: la condición
--   current_date = fc.fecha_corte - 1
-- pasa a
--   current_date between fc.fecha_corte - 2 and fc.fecha_corte - 1
-- (todo lo demás — casos 1, 2, 4, 5, el LATERAL de fecha_corte,
-- v_dashboard — queda exactamente igual que en
-- fix_por_vencer_estado.sql).
--
-- Como no se agregan/quitan/reordenan columnas (solo cambia la
-- lógica interna del CASE que arma "estado"), esta vez SÍ se puede
-- usar CREATE OR REPLACE VIEW sin problema de columnas corridas
-- (ese problema solo pasa cuando cambia el conjunto de columnas de
-- `clientes` por delante de las calculadas) y sin CASCADE (no se
-- borra la vista, así que v_dashboard no se ve afectada).
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

    -- 3) Faltan 1 o 2 días para la fecha de corte de este mes
    when current_date between fc.fecha_corte - 2 and fc.fecha_corte - 1 then 'Por vencer'

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

grant select on v_clientes_estado to anon, authenticated, service_role;
