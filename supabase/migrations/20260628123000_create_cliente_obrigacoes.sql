create table if not exists public.cliente_obrigacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  obrigacao_id uuid not null references public.obrigacoes(id) on delete cascade,
  created_at timestamptz default now(),
  unique (cliente_id, obrigacao_id)
);

create index if not exists cliente_obrigacoes_cliente_id_idx
  on public.cliente_obrigacoes (cliente_id);

create index if not exists cliente_obrigacoes_obrigacao_id_idx
  on public.cliente_obrigacoes (obrigacao_id);
