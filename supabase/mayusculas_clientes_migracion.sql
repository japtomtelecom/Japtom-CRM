-- ============================================================
-- Migración: pasar a MAYÚSCULAS Nombre, Dirección y CI de todos los
-- clientes existentes (de ahora en adelante el formulario ya los guarda
-- en mayúsculas automáticamente al escribir).
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

update clientes set nombre = upper(nombre) where nombre is not null;
update clientes set direccion = upper(direccion) where direccion is not null;
update clientes set ci = upper(ci) where ci is not null;
