import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const defaultSetores = [
  {
    nome: "Departamento Pessoal",
    responsavel: "Equipe DP",
    rotinas: 38,
    status: "Ativo",
    descricao: "Folha, admissao, ferias, rescisao, eSocial e obrigacoes trabalhistas.",
  },
  {
    nome: "Financeiro",
    responsavel: "Equipe Financeira",
    rotinas: 24,
    status: "Ativo",
    descricao: "Contas a pagar, contas a receber, BPO financeiro, conciliacao e cobranca.",
  },
  {
    nome: "Contabil",
    responsavel: "Equipe Contabil",
    rotinas: 31,
    status: "Ativo",
    descricao: "Lancamentos, conciliacoes, demonstrativos, fechamentos e analises contabeis.",
  },
  {
    nome: "Fiscal",
    responsavel: "Equipe Fiscal",
    rotinas: 46,
    status: "Ativo",
    descricao: "Notas fiscais, apuracoes, declaracoes, impostos e agenda fiscal.",
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [type, token] = authorization.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function createClients() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    adminClient: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

async function authorize(request: Request) {
  const clients = createClients();
  if (!clients) {
    return {
      error: NextResponse.json(
        { error: "Supabase Auth do servidor nao esta configurado. Configure SUPABASE_SERVICE_ROLE_KEY no .env.local." },
        { status: 500 }
      ),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "Sessao nao encontrada. Entre novamente no sistema." }, { status: 401 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await clients.authClient.auth.getUser(token);

  if (authError || !user?.email) {
    return { error: NextResponse.json({ error: "Sessao invalida. Entre novamente no sistema." }, { status: 401 }) };
  }

  const { data: caller, error: callerError } = await clients.adminClient
    .from("usuarios_sistema")
    .select("id,email,perfil,status")
    .ilike("email", user.email)
    .maybeSingle();

  if (callerError) {
    return { error: NextResponse.json({ error: `Nao foi possivel validar o usuario logado: ${callerError.message}` }, { status: 500 }) };
  }

  const isAllowed = caller && normalize(caller.status) !== "inativo" && ["administrador", "gestor"].includes(normalize(caller.perfil));
  if (!isAllowed) {
    return { error: NextResponse.json({ error: "Apenas usuarios ativos com perfil Administrador ou Gestor podem acessar setores." }, { status: 403 }) };
  }

  return { adminClient: clients.adminClient };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { data, error } = await auth.adminClient
    .from("setores")
    .select("id,nome,responsavel,descricao,rotinas,status")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `Erro ao buscar setores: ${error.message}` }, { status: 500 });
  }

  if (data && data.length > 0) {
    return NextResponse.json({ setores: data });
  }

  const { data: seededSetores, error: seedError } = await auth.adminClient
    .from("setores")
    .insert(defaultSetores)
    .select("id,nome,responsavel,descricao,rotinas,status");

  if (seedError) {
    return NextResponse.json({ error: `Erro ao criar setores iniciais: ${seedError.message}` }, { status: 400 });
  }

  return NextResponse.json({ setores: seededSetores ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const payload = await request.json();
  const { data, error } = await auth.adminClient
    .from("setores")
    .insert(payload)
    .select("id,nome,responsavel,descricao,rotinas,status")
    .single();

  if (error) {
    return NextResponse.json({ error: `Erro ao salvar setor: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ setor: data });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const payload = body.payload;

  if (!id || !payload) {
    return NextResponse.json({ error: "Informe o setor e os dados para atualizar." }, { status: 400 });
  }

  const { data, error } = await auth.adminClient
    .from("setores")
    .update(payload)
    .eq("id", id)
    .select("id,nome,responsavel,descricao,rotinas,status")
    .single();

  if (error) {
    return NextResponse.json({ error: `Erro ao atualizar setor: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ setor: data });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Informe o setor para excluir." }, { status: 400 });
  }

  const { error } = await auth.adminClient.from("setores").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Erro ao excluir setor: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
