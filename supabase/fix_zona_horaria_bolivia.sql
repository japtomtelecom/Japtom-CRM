-- ============================================================
-- Fix: "hoy" se calculaba en la zona horaria del servidor de
-- Supabase (UTC), no en hora de Bolivia (UTC-4) — 26/08/2026
--
-- Reportado por el usuario: con la ventana de "Por vencer" a 2
-- días recién puesta, un cliente con día de pago 26 seguía en
-- "Al día" y los de día 27 y 28 ya salían "Por vencer" — pero para
-- el usuario, en ese momento, "hoy" era 25. Haciendo la cuenta con
-- lo que reportó, la única fecha de "hoy" que explica esos tres
-- resultados a la vez es 26, no 25.
--
-- Causa: Bolivia está a UTC-4. Desde ~8pm hora boliviana en
-- adelante, en UTC ya es el día siguiente — así que `current_date`
-- (que Postgres calcula en la zona horaria configurada del
-- servidor, normalmente UTC en Supabase) se adelanta casi 4 horas
-- antes de la medianoche real en Bolivia. Esto afectaba TODOS los
-- estados (Al día / Por vencer / Vencido), no solo el nuevo.
--
-- Fix: en vez de usar `current_date` directo, se calcula una sola
-- vez "hoy" como `(now() at time zone 'America/La_Paz')::date` (vía
-- LATERAL, para no repetir la expresión) y se usa esa fecha en todo
-- el cálculo. Se corrige en las dos vistas que dependen de la fecha
-- de corte:
--   - v_clientes_estado (estado principal: Al día / Por vencer / Vencido)
--   - v_registro_pagos_mensual (detalle del botón 📅 "Ver registro
--     mensual" — tenía el mismo problema con sus propios estados
--     no_vencido / por_vencer / vencido, para no dejarla inconsistente
--     con el estado principal)
--
-- Ninguna de las dos cambia su lista de columnas (solo la lógica
-- interna), así que CREATE OR REPLACE VIEW funciona directo, sin
-- DROP/CASCADE ni tocar v_dashboard.
--
-- Nota: v_pagos_mes_actual (usada por v_clientes_estado para
-- "pagado_mes_actual") y el "cobrado_mes_actual" de v_dashboard
-- probablemente tengan el mismo problema con current_date, pero no
-- se tocan acá por no tener su definición confirmada y no haber un
-- reporte concreto de error en ellas — queda anotado para revisar
-- cuando se haga el volcado completo del schema (ver nota en
-- claude/fix-vencido-dia-pago.md y claude/estado-por-vencer-envio-masivo.md).
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
         and date_trunc('month', hb.hoy)::date <= date_trunc(
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

    -- 3) Faltan 1 o 2 días (hora de Bolivia) para la fecha de corte de este mes
    when hb.hoy between fc.fecha_corte - 2 and fc.fecha_corte - 1 then 'Por vencer'

    -- 4) Aún no llega (o es hoy, hora de Bolivia) la fecha de corte de este mes
    when hb.hoy <= fc.fecha_corte then 'Al día'

    -- 5) Pasada la fecha de corte
    else 'Vencido'
  end as estado
from clientes c
left join v_pagos_mes_actual pm on pm.cliente_id = c.id
left join v_cobertura_cliente cc on cc.cliente_id = c.id
left join lateral (select (now() at time zone 'America/La_Paz')::date as hoy) hb on true
left join lateral (
  select (
    date_trunc('month', hb.hoy)::date
    + (least(c.dia_pago, extract(day from date_trunc('month', hb.hoy)::date + interval '1 mon -1 days')::integer) - 1) * interval '1 day'
  )::date as fecha_corte
) fc on true;

grant select on v_clientes_estado to anon, authenticated, service_role;

create or replace view v_registro_pagos_mensual as
select
  c.id as cliente_id,
  c.nombre,
  c.dia_pago,
  m.periodo,
  case
    when cc.cubierto_hasta is not null
         and m.periodo <= date_trunc('month', cc.cubierto_hasta::timestamp)::date
      then 'pagado'
    when c.fecha_vencimiento_manual is not null
         and m.periodo >= date_trunc('month', hb.hoy)::date
         and m.periodo <= date_trunc('month', c.fecha_vencimiento_manual::timestamp)::date
      then 'pagado'
    else
      case
        when hb.hoy <= (m.periodo + (least(c.dia_pago, extract(day from m.periodo + interval '1 mon -1 days')::integer) - 1)::double precision * interval '1 day')::date
          then 'no_vencido'
        when hb.hoy <= ((m.periodo + (least(c.dia_pago, extract(day from m.periodo + interval '1 mon -1 days')::integer) - 1)::double precision * interval '1 day')::date + 5)
          then 'por_vencer'
        else 'vencido'
      end
  end as status,
  c.ciudad
from clientes c
  left join lateral (select (now() at time zone 'America/La_Paz')::date as hoy) hb on true
  cross join lateral generate_series(
    greatest('2026-07-01'::date, date_trunc('month', c.created_at)::date)::timestamp with time zone,
    date_trunc('month', hb.hoy::timestamp with time zone)::date::timestamp with time zone,
    '1 mon'::interval
  ) m(periodo)
  left join v_cobertura_cliente cc on cc.cliente_id = c.id
where c.activo = true
order by c.nombre, m.periodo;
