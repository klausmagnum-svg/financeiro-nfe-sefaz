create table if not exists public.usuarios_sistema (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  setor text not null,
  perfil text not null default 'Operador',
  senha_temporaria text,
  status text not null default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios_sistema
  add column if not exists nome text,
  add column if not exists email text,
  add column if not exists setor text,
  add column if not exists perfil text default 'Operador',
  add column if not exists senha_temporaria text,
  add column if not exists status text default 'Ativo',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.usuarios_sistema
set
  perfil = coalesce(perfil, 'Operador'),
  status = coalesce(status, 'Ativo'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());
