-- ============================================================
-- Migración: sucursal Copacabana
-- Ejecuta esto una sola vez en el SQL Editor de Supabase.
-- (Los clientes de La Paz siguen guardados como "El Alto".)
-- ============================================================

-- 1. Ampliar las restricciones check que limitan las ciudades/sucursales
--    (clientes.ciudad, perfiles.sucursal y cualquier otra tabla que tenga
--    una restricción con 'Tarija'), agregando 'Copacabana' a la lista.
do $$
declare
  r record;
  nueva text;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'c'
      and n.nspname = 'public'
      and pg_get_constraintdef(c.oid) like '%Tarija%'
      and pg_get_constraintdef(c.oid) not like '%Copacabana%'
  loop
    nueva := replace(r.def, '''Tarija''::text', '''Tarija''::text, ''Copacabana''::text');
    if nueva = r.def then
      nueva := replace(r.def, '''Tarija''', '''Tarija'', ''Copacabana''');
    end if;
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
    execute format('alter table %s add constraint %I %s', r.tabla, r.conname, nueva);
    raise notice 'Actualizada la restricción % de %', r.conname, r.tabla;
  end loop;
end $$;

-- 2. Acceso público (sin login) para Copacabana, igual que Tarija:
--    solo ver clientes de Copacabana, crear clientes nuevos de Copacabana
--    y registrar pagos de clientes de Copacabana.
drop policy if exists "clientes_select_anon_copacabana" on clientes;
create policy "clientes_select_anon_copacabana" on clientes for select
  using (auth.role() = 'anon' and ciudad = 'Copacabana');

drop policy if exists "clientes_insert_anon_copacabana" on clientes;
create policy "clientes_insert_anon_copacabana" on clientes for insert
  with check (auth.role() = 'anon' and ciudad = 'Copacabana');

drop policy if exists "pagos_insert_anon_copacabana" on pagos;
create policy "pagos_insert_anon_copacabana" on pagos for insert
  with check (
    auth.role() = 'anon'
    and exists (select 1 from clientes c where c.id = pagos.cliente_id and c.ciudad = 'Copacabana')
  );

-- 3. Verificación: debe listar las restricciones ya con 'Copacabana'
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where contype = 'c' and pg_get_constraintdef(oid) like '%Copacabana%';
