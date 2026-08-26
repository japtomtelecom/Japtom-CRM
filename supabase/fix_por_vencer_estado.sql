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
-- NOTA: se usa DROP + CREATE (no CREATE OR REPLACE) porque la
-- columna `telefono2` (agregada a `clientes` con
-- telefono2_migracion.sql) se cuela, vía `c.*`, ANTES de las
-- columnas calculadas (pagado_mes_actual, estado) y les corre la
-- posición — Postgres no permite eso con CREATE OR REPLACE VIEW
-- (solo permite agregar columnas nuevas al final), da el error
-- 42P16 "cannot change name of view column ... to telefono2".
-- Con DROP + CREATE no aplica esa restricción.
--
-- NOTA 2: apareció una vista `v_dashboard` (no estaba en ningún
-- archivo del repo, solo existía en Supabase) que depende de
-- v_clientes_estado — el DROP simple falló con 2BP01 "cannot drop
-- view v_clientes_estado because other objects depend on it". Se
-- usa DROP ... CASCADE (se lleva puesta v_dashboard también) y
-- después se recrea v_dashboard IDÉNTICA a como estaba (se pidió su
-- definición con pg_get_viewdef antes de tocar nada, mismo criterio
-- que en fix-vencido-dia-pago.md) — no se le cambió ninguna lógica.
-- Al final se vuelve a otorgar SELECT a los roles que usa Supabase
-- en ambas vistas (por si el DROP se llevó algún grant explícito;
-- los privilegios por defecto del proyecto normalmente ya cubren
-- esto, pero no está de más).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

drop view if exists v_clientes_estado cascade;

create view v_clientes_estado as
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

grant select on v_clientes_estado to anon, authenticated, service_role;

-- v_dashboard recreada tal cual estaba (se perdió con el CASCADE de arriba;
-- definición obtenida con pg_get_viewdef antes de borrar nada, sin cambios).
create view v_dashboard as
 SELECT ( SELECT count(*) AS count
           FROM clientes) AS total_clientes,
    ( SELECT count(*) AS count
           FROM clientes
          WHERE clientes.activo) AS clientes_activos,
    ( SELECT count(*) AS count
           FROM clientes
          WHERE NOT clientes.activo) AS clientes_inactivos,
    ( SELECT count(*) AS count
           FROM v_clientes_estado
          WHERE v_clientes_estado.activo AND v_clientes_estado.estado = 'Al día'::text) AS clientes_al_dia,
    ( SELECT count(*) AS count
           FROM v_clientes_estado
          WHERE v_clientes_estado.activo AND v_clientes_estado.estado = 'Vencido'::text) AS clientes_vencidos,
    ( SELECT COALESCE(sum(pagos.monto), 0::numeric) AS "coalesce"
           FROM pagos
          WHERE date_trunc('month'::text, pagos.fecha_pago::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)) AS cobrado_mes_actual,
    ( SELECT COALESCE(sum(pagos.monto), 0::numeric) AS "coalesce"
           FROM pagos) AS ingreso_historico,
    ( SELECT COALESCE(round(avg(pagos.monto), 2), 0::numeric) AS "coalesce"
           FROM pagos) AS ticket_promedio;

grant select on v_dashboard to anon, authenticated, service_role;
