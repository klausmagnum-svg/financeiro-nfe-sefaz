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

function createClients() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null;
  }

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
    .select("id,nome,email,perfil,status")
    .ilike("email", user.email)
    .maybeSingle();

  if (callerError) {
    return { error: NextResponse.json({ error: `Nao foi possivel validar o usuario logado: ${callerError.message}` }, { status: 500 }) };
  }

  const callerStatus = normalize(caller?.status);
  const callerPerfil = normalize(caller?.perfil);
  const canManageUsers = callerStatus !== "inativo" && ["administrador", "gestor"].includes(callerPerfil);

  if (!caller || !canManageUsers) {
    return { error: NextResponse.json({ error: "Apenas usuarios ativos com perfil Administrador ou Gestor podem acessar este cadastro." }, { status: 403 }) };
  }

  return { adminClient: clients.adminClient };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  let { data: usuarios, error: usuariosError } = await auth.adminClient
    .from("usuarios_sistema")
    .select("id,nome,email,setor,setores,perfil,status,permissoes")
    .order("nome", { ascending: true });

  if (usuariosError && usuariosError.message.toLowerCase().includes("permissoes")) {
    const fallback = await auth.adminClient
      .from("usuarios_sistema")
      .select("id,nome,email,setor,setores,perfil,status")
      .order("nome", { ascending: true });

    usuarios = fallback.data?.map((usuario) => ({ ...usuario, permissoes: {} })) ?? null;
    usuariosError = fallback.error;
  }

  const { data: setores, error: setoresError } = await auth.adminClient
    .from("setores")
    .select("id,nome")
    .order("nome", { ascending: true });

  if (usuariosError) {
    return NextResponse.json({ error: `Erro ao buscar usuarios: ${usuariosError.message}` }, { status: 500 });
  }

  if (setoresError) {
    return NextResponse.json({ error: `Erro ao buscar setores: ${setoresError.message}` }, { status: 500 });
  }

  return NextResponse.json({ usuarios: usuarios ?? [], setores: setores ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const payload = await request.json();
  let { data, error } = await auth.adminClient
    .from("usuarios_sistema")
    .insert(payload)
    .select("id,nome,email,setor,setores,perfil,status,permissoes")
    .single();

  if (error && error.message.toLowerCase().includes("permissoes")) {
    const fallback = await auth.adminClient
      .from("usuarios_sistema")
      .insert(payload)
      .select("id,nome,email,setor,setores,perfil,status")
      .single();

    data = fallback.data ? { ...fallback.data, permissoes: {} } : null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: `Erro ao salvar usuario: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ usuario: data });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const payload = body.payload;

  if (!id || !payload) {
    return NextResponse.json({ error: "Informe o usuario e os dados para atualizar." }, { status: 400 });
  }

  let { data, error } = await auth.adminClient
    .from("usuarios_sistema")
    .update(payload)
    .eq("id", id)
    .select("id,nome,email,setor,setores,perfil,status,permissoes")
    .single();

  if (error && error.message.toLowerCase().includes("permissoes")) {
    if (Object.prototype.hasOwnProperty.call(payload, "permissoes")) {
      return NextResponse.json(
        { error: "A coluna permissoes ainda nao existe no Supabase. Aplique a migration 20260630170000_add_permissoes_usuarios.sql." },
        { status: 400 }
      );
    }

    const fallback = await auth.adminClient
      .from("usuarios_sistema")
      .update(payload)
      .eq("id", id)
      .select("id,nome,email,setor,setores,perfil,status")
      .single();

    data = fallback.data ? { ...fallback.data, permissoes: {} } : null;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: `Erro ao atualizar usuario: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ usuario: data });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Informe o usuario para excluir." }, { status: 400 });
  }

  const { error } = await auth.adminClient.from("usuarios_sistema").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: `Erro ao excluir usuario: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
