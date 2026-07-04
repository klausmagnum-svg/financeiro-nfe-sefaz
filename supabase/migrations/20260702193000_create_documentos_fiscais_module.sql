create table if not exists public.cliente_certificados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  tipo_certificado text not null default 'A1',
  finalidade text default 'Geral',
  principal boolean default false,
  arquivo_nome_original text,
  arquivo_storage_path text,
  drive_file_id text,
  senha_criptografada text,
  cnpj_cpf_titular text,
  razao_social_titular text,
  emissor text,
  numero_serie text,
  data_emissao date,
  data_validade date,
  status text default 'Não testado',
  ativo boolean default true,
  observacoes text,
  ultimo_teste_em timestamptz,
  ultimo_uso_em timestamptz,
  mensagem_ultimo_erro text,
  criado_por text,
  atualizado_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists cliente_certificados_cliente_id_idx
  on public.cliente_certificados (cliente_id);

create unique index if not exists cliente_certificados_principal_ativo_idx
  on public.cliente_certificados (cliente_id)
  where principal is true and ativo is true and deleted_at is null;

create table if not exists public.cliente_certificados_auditoria (
  id uuid primary key default gen_random_uuid(),
  certificado_id uuid references public.cliente_certificados(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete cascade,
  evento text not null,
  mensagem text,
  usuario text,
  created_at timestamptz default now()
);

create table if not exists public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo_documento text not null,
  numero text,
  serie text,
  chave_acesso text,
  data_emissao date,
  data_entrada date,
  valor_total numeric(14, 2),
  emitente_cnpj_cpf text,
  emitente_nome text,
  destinatario_cnpj_cpf text,
  destinatario_nome text,
  municipio text,
  uf text,
  status_documento text,
  origem text,
  xml_storage_path text,
  pdf_storage_path text,
  json_dados jsonb default '{}'::jsonb,
  possui_pendencia boolean default false,
  status_processamento text default 'Pendente',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists documentos_fiscais_cliente_id_idx
  on public.documentos_fiscais (cliente_id);

create index if not exists documentos_fiscais_chave_acesso_idx
  on public.documentos_fiscais (chave_acesso);

create table if not exists public.documentos_fiscais_sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo_documento text,
  certificado_id uuid references public.cliente_certificados(id) on delete set null,
  status text default 'Aguardando',
  data_inicio timestamptz,
  data_fim timestamptz,
  quantidade_encontrada integer default 0,
  quantidade_importada integer default 0,
  quantidade_erro integer default 0,
  mensagem text,
  log text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documentos_fiscais_pendencias (
  id uuid primary key default gen_random_uuid(),
  documento_fiscal_id uuid references public.documentos_fiscais(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  tipo_pendencia text not null,
  descricao text,
  status text default 'ABERTA',
  responsavel_id uuid,
  resolvido_por text,
  resolvido_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists documentos_fiscais_pendencias_cliente_id_idx
  on public.documentos_fiscais_pendencias (cliente_id);
