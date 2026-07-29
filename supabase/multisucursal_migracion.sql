-- ============================================================
-- Migración: Multi-sucursal (El Alto / Tarija) + acceso público
-- sin login para Tarija (solo alta de clientes y registro de pagos).
-- Ejecuta esto en el SQL Editor de Supabase DESPUÉS de schema.sql
-- y roles_migracion.sql.
-- ============================================================

-- 1. Columna de ciudad en clientes
alter table clientes add column if not exists ciudad text not null default 'El Alto'
  check (ciudad in ('El Alto', 'Tarija'));
create index if not exists idx_clientes_ciudad on clientes (ciudad);

-- Tus clientes actuales (todos cargados desde el Excel original) quedan
-- marcados como "El Alto" por el default de arriba — no necesitas hacer nada más.

-- ============================================================
-- 2. Acceso público (SIN login) para la sucursal de Tarija
-- Estas políticas aplican al rol "anon" (el que usa cualquiera que entre
-- al enlace público, sin haber iniciado sesión). Son intencionalmente
-- muy limitadas: solo pueden ver/crear datos DE TARIJA, nada de El Alto,
-- y no pueden editar ni borrar nada.
-- ============================================================

-- Ver el catálogo de planes (para elegir un plan al cargar un cliente nuevo)
drop policy if exists "planes_select_anon" on planes;
create policy "planes_select_anon" on planes for select
  using (auth.role() = 'anon');

-- Ver SOLO clientes de Tarija (necesario para buscar a quién registrarle un pago)
drop policy if exists "clientes_select_anon_tarija" on clientes;
create policy "clientes_select_anon_tarija" on clientes for select
  using (auth.role() = 'anon' and ciudad = 'Tarija');

-- Crear SOLO clientes nuevos de Tarija (no puede crear de "El Alto")
drop policy if exists "clientes_insert_anon_tarija" on clientes;
create policy "clientes_insert_anon_tarija" on clientes for insert
  with check (auth.role() = 'anon' and ciudad = 'Tarija');

-- Registrar pagos SOLO para clientes que sean de Tarija
drop policy if exists "pagos_insert_anon_tarija" on pagos;
create policy "pagos_insert_anon_tarija" on pagos for insert
  with check (
    auth.role() = 'anon'
    and exists (select 1 from clientes c where c.id = pagos.cliente_id and c.ciudad = 'Tarija')
  );

-- (No se agrega policy de select para pagos ni de update/delete para el rol
-- anónimo — así el enlace público de Tarija nunca puede ver historiales de
-- pago, ni editar o borrar nada; solo agregar cliente y registrar pago.)
