create table if not exists public.cliente_anexos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  mime_type text,
  tamanho bigint,
  drive_file_id text not null,
  drive_web_view_link text,
  categoria text default 'Documento',
  criado_por text,
  criado_em timestamptz default now()
);

create index if not exists cliente_anexos_cliente_id_idx
  on public.cliente_anexos (cliente_id);

alter table public.cliente_anexos
  add column if not exists nome text,
  add column if not exists mime_type text,
  add column if not exists tamanho bigint,
  add column if not exists drive_file_id text,
  add column if not exists drive_web_view_link text,
  add column if not exists categoria text default 'Documento',
  add column if not exists criado_por text,
  add column if not exists criado_em timestamptz default now();
