-- ============================================================
-- Fix: "Marcar al día" (fecha_vencimiento_manual) no debe reescribir
-- meses PASADOS como "Pagado" si no hubo un pago real registrado ahí.
--
-- Reportado con TRJ00001 (Alain Oliver Gutierrez, Tarija): sin ningún
-- pago cargado, un solo clic en "Marcar al día" hizo que julio Y
-- agosto aparecieran como "Pagado" en el registro mensual.
--
-- Causa: v_registro_pagos_mensual comparaba cada período contra
-- GREATEST(cubierto_hasta, fecha_vencimiento_manual) con un solo
-- límite superior, sin límite inferior. Al mover fecha_vencimiento_manual
-- a futuro (ej. "hoy + 1 mes"), TODO período <= ese mes (incluyendo
-- meses ya pasados sin pago real) calzaba como "pagado".
--
-- Corrección: se separan las dos fuentes de cobertura:
--   - cc.cubierto_hasta (pagos reales, con mes_corresponde/meses_cubiertos)
--     sigue pudiendo cubrir cualquier período, pasado o futuro — es un
--     pago real, tiene sentido que "blanquee" el mes que efectivamente pagó.
--   - c.fecha_vencimiento_manual ("Marcar al día") ahora SOLO puede cubrir
--     el mes actual en adelante. Nunca reescribe un mes anterior al mes
--     en curso como pagado.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace view v_registro_pagos_mensual as
select
  c.id as cliente_id,
  c.nombre,
  c.dia_pago,
  m.periodo,
  case
    -- Pago real registrado que cubre este período
    when cc.cubierto_hasta is not null
         and m.periodo <= date_trunc('month', cc.cubierto_hasta::timestamp)::date
      then 'pagado'
    -- "Marcar al día": solo cubre desde el mes actual en adelante,
    -- nunca reescribe meses pasados sin pago real.
    when c.fecha_vencimiento_manual is not null
         and m.periodo >= date_trunc('month', current_date)::date
         and m.periodo <= date_trunc('month', c.fecha_vencimiento_manual::timestamp)::date
      then 'pagado'
    else
      case
        when current_date <= (m.periodo + (least(c.dia_pago, extract(day from m.periodo + interval '1 mon -1 days')::integer) - 1)::double precision * interval '1 day')::date
          then 'no_vencido'
        when current_date <= ((m.periodo + (least(c.dia_pago, extract(day from m.periodo + interval '1 mon -1 days')::integer) - 1)::double precision * interval '1 day')::date + 5)
          then 'por_vencer'
        else 'vencido'
      end
  end as status,
  c.ciudad
from clientes c
  cross join generate_series(
    '2026-07-01'::date::timestamp with time zone,
    date_trunc('month', current_date::timestamp with time zone)::date::timestamp with time zone,
    '1 mon'::interval
  ) m(periodo)
  left join v_cobertura_cliente cc on cc.cliente_id = c.id
where c.activo = true
order by c.nombre, m.periodo;
