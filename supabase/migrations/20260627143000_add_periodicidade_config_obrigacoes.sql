alter table public.obrigacoes
  add column if not exists regras_vencimento jsonb default '[]'::jsonb,
  add column if not exists periodicidade_config jsonb default '{}'::jsonb;

update public.obrigacoes
set
  regras_vencimento = coalesce(regras_vencimento, '[]'::jsonb),
  periodicidade_config = coalesce(periodicidade_config, '{}'::jsonb);
