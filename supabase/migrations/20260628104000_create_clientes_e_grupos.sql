create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  data_abertura date,
  nome_fantasia text,
  tipo text,
  matriz_filial text,
  identificacao text,
  inscricao_estadual text,
  inscricao_municipal text,
  cei text,
  cep text,
  logradouro text,
  regime_tributario text,
  numero text,
  complemento text,
  grupo_clientes text,
  bairro text,
  estado text,
  municipio text,
  email text,
  contato text,
  data_inicio_controle_obrigacoes text,
  observacao text,
  status text default 'Ativo',
  created_at timestamptz default now()
);

create table if not exists public.grupos_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  clientes integer default 0,
  status text default 'Ativo',
  descricao text,
  created_at timestamptz default now()
);

alter table public.clientes
  add column if not exists razao_social text,
  add column if not exists data_abertura date,
  add column if not exists nome_fantasia text,
  add column if not exists tipo text,
  add column if not exists matriz_filial text,
  add column if not exists identificacao text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists cei text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists regime_tributario text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists grupo_clientes text,
  add column if not exists bairro text,
  add column if not exists estado text,
  add column if not exists municipio text,
  add column if not exists email text,
  add column if not exists contato text,
  add column if not exists data_inicio_controle_obrigacoes text,
  add column if not exists observacao text,
  add column if not exists status text default 'Ativo',
  add column if not exists created_at timestamptz default now();

alter table public.grupos_clientes
  add column if not exists nome text,
  add column if not exists responsavel text,
  add column if not exists clientes integer default 0,
  add column if not exists status text default 'Ativo',
  add column if not exists descricao text,
  add column if not exists created_at timestamptz default now();

update public.clientes
set
  status = coalesce(status, 'Ativo'),
  created_at = coalesce(created_at, now());

update public.grupos_clientes
set
  clientes = coalesce(clientes, 0),
  status = coalesce(status, 'Ativo'),
  created_at = coalesce(created_at, now());
