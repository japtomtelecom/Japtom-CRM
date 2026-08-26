-- ============================================================
-- Agrega un segundo teléfono opcional al cliente (ej. familiar,
-- contacto alternativo), para poder mandarle el recordatorio de
-- WhatsApp también a ese número desde la ficha del cliente.
--
-- v_clientes_estado usa "select c.*" (ver supabase/schema.sql),
-- así que toma esta columna nueva automáticamente sin tener que
-- recrear la vista.
--
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

alter table clientes add column if not exists telefono2 text;
