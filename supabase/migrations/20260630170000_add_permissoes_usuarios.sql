alter table public.usuarios_sistema
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

