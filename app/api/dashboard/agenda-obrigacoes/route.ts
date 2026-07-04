import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase Auth do servidor nao esta configurado. Configure SUPABASE_SERVICE_ROLE_KEY no .env.local." },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao nao encontrada. Entre novamente no sistema." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Sessao invalida. Entre novamente no sistema." }, { status: 401 });
  }

  const { data: usuario, error: usuarioError } = await adminClient
    .from("usuarios_sistema")
    .select("id,email,status")
    .ilike("email", user.email)
    .maybeSingle();

  if (usuarioError) {
    return NextResponse.json({ error: `Nao foi possivel validar o usuario logado: ${usuarioError.message}` }, { status: 500 });
  }

  if (!usuario || normalize(usuario.status) === "inativo") {
    return NextResponse.json({ error: "Usuario nao encontrado ou inativo no Cadastro / Usuarios." }, { status: 403 });
  }

  const [{ data: obrigacoes, error: obrigacoesError }, { data: clientes, error: clientesError }] = await Promise.all([
    adminClient
      .from("obrigacoes")
      .select("id,nome,validacao,regime,periodicidade,prazo,mes,dias,meses_subsequentes,data_inicio,tipo_prazo,prazo_util,ajuste_prazo,regras_vencimento,setor,status")
      .order("nome", { ascending: true }),
    adminClient
      .from("clientes")
      .select("id,razao_social,nome_fantasia,identificacao,regime_tributario,obrigacoes_vinculadas,status")
      .order("razao_social", { ascending: true }),
  ]);

  if (obrigacoesError) {
    return NextResponse.json({ error: `Nao foi possivel carregar as obrigacoes: ${obrigacoesError.message}` }, { status: 500 });
  }

  if (clientesError) {
    return NextResponse.json({ error: `Nao foi possivel carregar os clientes: ${clientesError.message}` }, { status: 500 });
  }

  return NextResponse.json({ obrigacoes: obrigacoes ?? [], clientes: clientes ?? [] });
}
