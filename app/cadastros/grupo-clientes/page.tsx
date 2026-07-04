"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ConfirmDeleteModal from "@/app/components/ConfirmDeleteModal";
import ErpChrome from "@/app/components/ErpChrome";
import { supabase } from "@/app/lib/supabaseClient";

type GrupoCliente = {
  id: string;
  nome: string;
  responsavel: string | null;
  clientes: number;
  status: string;
  descricao: string | null;
};

type Cliente = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  identificacao: string | null;
  grupo_clientes: string | null;
};

const defaultGrupos = [
  {
    nome: "Clientes recorrentes",
    responsavel: "Equipe Atendimento",
    clientes: 0,
    status: "Ativo",
    descricao: "Clientes com rotinas mensais e acompanhamento permanente.",
  },
  {
    nome: "Projetos pontuais",
    responsavel: "Equipe Comercial",
    clientes: 0,
    status: "Ativo",
    descricao: "Clientes vinculados a demandas avulsas, implantacoes ou consultorias.",
  },
];

const emptyForm = {
  nome: "",
  descricao: "",
};

function ActionIcon({ type }: { type: "edit" | "delete" }) {
  const paths = {
    edit: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4z" /></>,
    delete: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };

  return (
    <svg className={`size-4 ${type === "delete" ? "text-rose-400" : "text-slate-300"} transition hover:text-sky-300`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      {paths[type]}
    </svg>
  );
}

export default function GrupoClientesPage() {
  const [grupos, setGrupos] = useState<GrupoCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GrupoCliente | null>(null);
  const [selectedClienteIds, setSelectedClienteIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    async function loadGrupos() {
      setIsLoading(true);
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id,razao_social,nome_fantasia,identificacao,grupo_clientes")
        .order("razao_social", { ascending: true });

      if (clientesError) {
        setFeedback(`Erro ao buscar clientes: ${clientesError.message}`);
        setIsLoading(false);
        return;
      }

      setClientes(clientesData ?? []);

      const { data, error } = await supabase
        .from("grupos_clientes")
        .select("id,nome,responsavel,descricao,clientes,status")
        .order("created_at", { ascending: true });

      if (error) {
        setFeedback(`Erro ao buscar grupos de clientes: ${error.message}`);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setGrupos(data);
        setIsLoading(false);
        return;
      }

      const { data: seededGrupos, error: seedError } = await supabase
        .from("grupos_clientes")
        .insert(defaultGrupos)
        .select("id,nome,responsavel,descricao,clientes,status");

      if (seedError) {
        setFeedback(`Erro ao criar grupos iniciais: ${seedError.message}`);
        setIsLoading(false);
        return;
      }

      setGrupos(seededGrupos ?? []);
      setIsLoading(false);
    }

    loadGrupos();
  }, []);

  const clientesPorGrupo = useMemo(() => {
    return clientes.reduce<Record<string, Cliente[]>>((groups, cliente) => {
      const grupo = cliente.grupo_clientes || "";
      if (!grupo) return groups;
      groups[grupo] = groups[grupo] ?? [];
      groups[grupo].push(cliente);
      return groups;
    }, {});
  }, [clientes]);

  const filteredGrupos = useMemo(() => {
    return grupos.filter((grupo) =>
      `${grupo.nome} ${grupo.descricao} ${(clientesPorGrupo[grupo.nome] ?? []).map((cliente) => cliente.razao_social).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [clientesPorGrupo, grupos, search]);

  async function atualizarVinculosClientes(groupName: string, previousGroupName: string | null) {
    if (previousGroupName) {
      const { error: clearError } = await supabase
        .from("clientes")
        .update({ grupo_clientes: null })
        .eq("grupo_clientes", previousGroupName);

      if (clearError) {
        throw new Error(`Erro ao limpar empresas vinculadas: ${clearError.message}`);
      }
    }

    if (selectedClienteIds.length > 0) {
      const { error: linkError } = await supabase
        .from("clientes")
        .update({ grupo_clientes: groupName })
        .in("id", selectedClienteIds);

      if (linkError) {
        throw new Error(`Erro ao vincular empresas: ${linkError.message}`);
      }
    }

    setClientes((current) =>
      current.map((cliente) => {
        if (previousGroupName && cliente.grupo_clientes === previousGroupName) {
          return { ...cliente, grupo_clientes: selectedClienteIds.includes(cliente.id) ? groupName : null };
        }

        if (selectedClienteIds.includes(cliente.id)) {
          return { ...cliente, grupo_clientes: groupName };
        }

        return cliente;
      })
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    const nome = form.nome.trim();

    if (!nome) {
      setFeedback("Informe o nome do grupo.");
      return;
    }

    const payload = {
      nome,
      responsavel: "Sem responsavel",
      clientes: selectedClienteIds.length,
      descricao: form.descricao.trim() || "Sem descricao cadastrada.",
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("grupos_clientes")
        .update(payload)
        .eq("id", editingId)
        .select("id,nome,responsavel,descricao,clientes,status")
        .single();

      if (error) {
        setFeedback(`Erro ao atualizar grupo: ${error.message}`);
        return;
      }

      try {
        await atualizarVinculosClientes(nome, editingOriginalName);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Erro ao vincular empresas ao grupo.");
        return;
      }

      setGrupos((current) => current.map((grupo) => (grupo.id === editingId && data ? data : grupo)));
      setEditingId(null);
      setEditingOriginalName(null);
      setSelectedClienteIds([]);
      setForm(emptyForm);
      setFeedback("Grupo atualizado com sucesso.");
      return;
    }

    const { data, error } = await supabase
      .from("grupos_clientes")
      .insert({ ...payload, status: "Ativo" })
      .select("id,nome,responsavel,descricao,clientes,status")
      .single();

    if (error) {
      setFeedback(`Erro ao salvar grupo: ${error.message}`);
      return;
    }

    try {
      await atualizarVinculosClientes(nome, null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Erro ao vincular empresas ao grupo.");
      return;
    }

    if (data) {
      setGrupos((current) => [...current, data]);
    }
    setSelectedClienteIds([]);
    setForm(emptyForm);
    setFeedback("Grupo cadastrado com sucesso.");
  }

  function editarGrupo(grupo: GrupoCliente) {
    setEditingId(grupo.id);
    setEditingOriginalName(grupo.nome);
    setSelectedClienteIds(clientes.filter((cliente) => cliente.grupo_clientes === grupo.nome).map((cliente) => cliente.id));
    setForm({
      nome: grupo.nome,
      descricao: grupo.descricao ?? "",
    });
  }

  async function excluirGrupo(grupo: GrupoCliente) {
    setFeedback("");
    setIsDeleting(true);
    const { error: clearError } = await supabase
      .from("clientes")
      .update({ grupo_clientes: null })
      .eq("grupo_clientes", grupo.nome);
    setIsDeleting(false);

    if (clearError) {
      setFeedback(`Erro ao limpar empresas vinculadas: ${clearError.message}`);
      return;
    }

    setIsDeleting(true);
    const { error } = await supabase.from("grupos_clientes").delete().eq("id", grupo.id);
    setIsDeleting(false);

    if (error) {
      setFeedback(`Erro ao excluir grupo: ${error.message}`);
      return;
    }

    setClientes((current) => current.map((cliente) => (cliente.grupo_clientes === grupo.nome ? { ...cliente, grupo_clientes: null } : cliente)));
    setGrupos((current) => current.filter((item) => item.id !== grupo.id));

    if (editingId === grupo.id) {
      setEditingId(null);
      setEditingOriginalName(null);
      setSelectedClienteIds([]);
      setForm(emptyForm);
    }

    setDeleteTarget(null);
    setFeedback("Grupo excluido com sucesso.");
  }

  return (
    <ErpChrome>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Cadastro</p>
        <h1 className="mt-1 text-2xl font-black leading-tight">Grupo de clientes</h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
          Organize clientes em carteiras, grupos comerciais ou conjuntos de atendimento para facilitar filtros e acompanhamentos.
        </p>
      </header>

      <section className="mt-5 grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1040px]:grid-cols-1">
        <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3">
            <svg className="size-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" />
            </svg>
            <input className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar grupo ou empresa vinculada" type="search" value={search} />
          </label>

          <div className="mt-4 grid gap-3">
            {isLoading && (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-center text-xs text-slate-400">
                Carregando grupos do Supabase...
              </div>
            )}

            {!isLoading && filteredGrupos.map((grupo) => {
              const empresasVinculadas = clientesPorGrupo[grupo.nome] ?? [];

              return (
                <section className="rounded-xl border border-white/10 bg-white/[0.045] p-4" key={grupo.id}>
                  <div className="flex items-start justify-between gap-3 max-[560px]:flex-col">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black text-slate-100">{grupo.nome}</h2>
                        <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-bold text-sky-100">
                          {grupo.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{grupo.descricao}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button aria-label="Editar grupo" title="Editar" onClick={() => editarGrupo(grupo)} type="button"><ActionIcon type="edit" /></button>
                      <button aria-label="Excluir grupo" title="Excluir" onClick={() => setDeleteTarget(grupo)} type="button"><ActionIcon type="delete" /></button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                    <small className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Clientes vinculados</small>
                    {empresasVinculadas.length}
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5 max-[1180px]:grid-cols-3 max-[860px]:grid-cols-2 max-[560px]:grid-cols-1">
                    {empresasVinculadas.length > 0 ? (
                      empresasVinculadas.map((cliente) => (
                        <span className="min-w-0 rounded-lg border border-white/10 bg-slate-950/45 px-2.5 py-2 text-[11px] leading-4 text-slate-300" key={cliente.id}>
                          <strong className="block truncate text-slate-100" title={cliente.razao_social}>{cliente.razao_social}</strong>
                          <span className="mt-0.5 block whitespace-nowrap text-[10px] text-slate-500">{cliente.identificacao || "Sem identificacao"}</span>
                        </span>
                      ))
                    ) : (
                      <p className="col-span-full rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-[11px] text-slate-500">
                        Nenhum cliente vinculado.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}

            {!isLoading && filteredGrupos.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-center text-xs text-slate-400">
                Nenhum grupo encontrado.
              </div>
            )}
          </div>
        </article>

        <aside className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h2 className="text-sm font-black text-slate-100">{editingId ? "Editar grupo" : "Cadastrar grupo"}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {editingId
              ? "Altere o grupo e escolha as empresas que ficarao vinculadas a ele."
              : "Crie um grupo e selecione as empresas relacionadas."}
          </p>

          {feedback && <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">{feedback}</p>}

          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Nome do grupo</span>
              <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600" onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex.: Clientes premium" value={form.nome} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Empresas relacionadas</span>
              <select
                className="min-h-48 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none"
                multiple
                onChange={(event) => setSelectedClienteIds(Array.from(event.target.selectedOptions).map((option) => option.value))}
                value={selectedClienteIds}
              >
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razao_social}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500">{selectedClienteIds.length} cliente(s) selecionado(s)</span>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Descricao</span>
              <textarea className="min-h-24 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600" onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Como este grupo deve ser usado?" value={form.descricao} />
            </label>
            <div className="mt-1 grid gap-2">
              <button className="min-h-10 rounded-lg bg-sky-300 px-4 text-xs font-black text-slate-950 shadow-[0_18px_42px_rgba(56,189,248,0.20)]" type="submit">
                {editingId ? "Atualizar grupo" : "Salvar grupo"}
              </button>
              {editingId && (
                <button className="min-h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-100" onClick={() => { setEditingId(null); setEditingOriginalName(null); setSelectedClienteIds([]); setForm(emptyForm); }} type="button">
                  Cancelar edicao
                </button>
              )}
            </div>
          </form>
        </aside>
      </section>
      <ConfirmDeleteModal
        isDeleting={isDeleting}
        isOpen={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void excluirGrupo(deleteTarget);
        }}
      />
    </ErpChrome>
  );
}
