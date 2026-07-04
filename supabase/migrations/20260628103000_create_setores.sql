create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  descricao text,
  rotinas integer default 0,
  status text default 'Ativo',
  created_at timestamptz default now()
);

alter table public.setores
  add column if not exists nome text,
  add column if not exists responsavel text,
  add column if not exists descricao text,
  add column if not exists rotinas integer default 0,
  add column if not exists status text default 'Ativo',
  add column if not exists created_at timestamptz default now();

update public.setores
set
  rotinas = coalesce(rotinas, 0),
  status = coalesce(status, 'Ativo'),
  created_at = coalesce(created_at, now());
