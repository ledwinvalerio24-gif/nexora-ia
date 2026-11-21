-- Ejecutar una sola vez en SQL Editor del proyecto existente.
-- Conserva datos y políticas RLS de Nexora 6.3.
alter table public.nexora_businesses add column if not exists timezone text not null default 'America/New_York';
alter table public.nexora_businesses add column if not exists opening_hours text not null default '';
alter table public.nexora_businesses add column if not exists services_text text not null default '';
alter table public.nexora_businesses add column if not exists instructions text not null default '';
-- La seguridad depende de las políticas RLS existentes: verificar antes de producción.
