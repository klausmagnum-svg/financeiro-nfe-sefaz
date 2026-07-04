alter table public.clientes
  add column if not exists obrigacoes_vinculadas text[] default '{}'::text[];

update public.clientes
set obrigacoes_vinculadas = coalesce(obrigacoes_vinculadas, '{}'::text[]);
