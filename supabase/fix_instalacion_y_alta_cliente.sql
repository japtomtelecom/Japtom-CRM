-- ============================================================
-- Fix: dos problemas encontrados con el cliente TRJ00005 (Pedro
-- Mampazo Callahuary), instalado el 18/08/2026, con solo un pago
-- de "Costo de instalación" cargado (mes_corresponde = agosto,
-- meses_cubiertos = 0).
--
-- PROBLEMA 1: v_cobertura_cliente calculaba
--   cubierto_hasta = mes_corresponde + (meses_cubiertos - 1) meses
-- Para un pago de "Costo de instalación" (meses_cubiertos = 0), esto
-- da mes_corresponde - 1 mes, es decir: un pago de instalación en
-- agosto "cubría" retroactivamente julio como si fuera una mensualidad
-- pagada, cuando en realidad un costo de instalación no debería
-- contar como cobertura de NINGÚN mes de servicio.
--
-- Fix: v_cobertura_cliente ahora ignora los pagos con
-- meses_cubiertos <= 0 (o null) al calcular la cobertura. Esto
-- también corrige una variante más grave: si "hoy" hubiera caído
-- dentro del mes fantasma, el aviso principal (v_clientes_estado)
-- podría haber mostrado "Al día" sin que el cliente hubiera pagado
-- ninguna mensualidad real.
--
-- PROBLEMA 2: v_registro_pagos_mensual arrancaba el detalle mensual
-- siempre desde julio de 2026 para TODOS los clientes, sin importar
-- cuándo se dieron de alta. Un cliente instalado hoy igual aparecía
-- evaluado (y podía salir "Vencido" o "Pagado" por error) para meses
-- anteriores a su alta, en los que ni siquiera era cliente.
--
-- Fix: cada cliente ahora arranca su serie de meses desde el mes de
-- su fecha de alta (columna "created_at"), o desde julio 2026 si es
-- más antiguo que eso (para no perder el historial ya cargado).
--
-- Probado en una base de prueba con: cliente nuevo con solo pago de
-- instalación (ya no aparece "julio pagado" — directamente no
-- aparece julio), cliente instalado a fin de mes con su primera
-- mensualidad (sigue funcionando igual que antes), y cliente viejo
-- sin pagos (sigue mostrando "Vencido" como corresponde).
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create or replace view v_cobertura_cliente as
select cliente_id,
  max((mes_corresponde + (meses_cubiertos - 1)::double precision * '1 mon'::interval)::date) as cubierto_hasta
from pagos
where meses_cubiertos > 0
group by cliente_id;

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
  cross join lateral generate_series(
    greatest('2026-07-01'::date, date_trunc('month', c.created_at)::date)::timestamp with time zone,
    date_trunc('month', current_date::timestamp with time zone)::date::timestamp with time zone,
    '1 mon'::interval
  ) m(periodo)
  left join v_cobertura_cliente cc on cc.cliente_id = c.id
where c.activo = true
order by c.nombre, m.periodo;
