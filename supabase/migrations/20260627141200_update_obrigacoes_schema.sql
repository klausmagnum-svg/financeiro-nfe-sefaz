alter table public.obrigacoes
  add column if not exists validacao boolean default false,
  add column if not exists regime text,
  add column if not exists periodicidade text,
  add column if not exists prazo text,
  add column if not exists setor text,
  add column if not exists status text default 'Ativo',
  add column if not exists tipo_evento text,
  add column if not exists esfera text,
  add column if not exists matriz_filial text,
  add column if not exists base_legal text,
  add column if not exists tipo_competencia text,
  add column if not exists competencia text,
  add column if not exists mes text,
  add column if not exists dias text,
  add column if not exists meses_subsequentes text,
  add column if not exists data_inicio text,
  add column if not exists regimes text[] default '{}'::text[],
  add column if not exists tipo_prazo text,
  add column if not exists prazo_util text,
  add column if not exists exigir_anexo text,
  add column if not exists ajuste_prazo text,
  add column if not exists estados text[] default '{}'::text[],
  add column if not exists instrucoes text,
  add column if not exists mensagem_padrao text,
  add column if not exists created_at timestamptz default now();

update public.obrigacoes
set
  validacao = coalesce(validacao, false),
  status = coalesce(status, 'Ativo'),
  regimes = coalesce(regimes, '{}'::text[]),
  estados = coalesce(estados, '{}'::text[]),
  created_at = coalesce(created_at, now());
