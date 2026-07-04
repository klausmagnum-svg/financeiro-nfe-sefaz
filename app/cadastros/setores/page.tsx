"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ConfirmDeleteModal from "@/app/components/ConfirmDeleteModal";
import ErpChrome from "@/app/components/ErpChrome";
import { supabase } from "@/app/lib/supabaseClient";

type Setor = {
  id: string;
  nome: string;
  responsavel: string | null;
  rotinas: number;
  status: string;
  descricao: string | null;
};

type SetoresApiResponse = {
  setores?: Setor[];
  setor?: Setor;
  error?: string;
};

const emptyForm = {
  nome: "",
  responsavel: "",
  descricao: "",
};

function ActionIcon({ type }: { type: "edit" | "delete" }) {
  const paths = {
    edit: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4z" /></>,
    delete: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };

  return (
    <svg
      className={`size-4 ${type === "delete" ? "text-rose-400" : "text-slate-300"} transition hover:text-sky-300`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[type]}
    </svg>
  );
}

async function requestSetoresApi(path = "/api/setores", init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      response: null,
      result: { error: "Sessão não encontrada. Entre novamente no sistema." } as SetoresApiResponse,
    };
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const result = await response.json().catch(() => ({} as SetoresApiResponse));
  return { response, result };
}

export default function SetoresPage() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    async function loadSetores() {
      setIsLoading(true);
      const { response, result } = await requestSetoresApi();

      if (!response?.ok) {
        setFeedback(result.error || "Erro ao buscar setores.");
        setIsLoading(false);
        return;
      }

      setSetores(result.setores ?? []);
      setIsLoading(false);
    }

    loadSetores();
  }, []);

  const filteredSetores = useMemo(() => {
    return setores.filter((setor) =>
      `${setor.nome} ${setor.responsavel} ${setor.descricao}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, setores]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!form.nome.trim()) {
      setFeedback("Informe o nome do setor.");
      return;
    }

    if (editingId) {
      const updatedSetor = {
        nome: form.nome.trim(),
        responsavel: form.responsavel.trim() || "Sem responsável",
        descricao: form.descricao.trim() || "Sem descrição cadastrada.",
      };
      const { response, result } = await requestSetoresApi("/api/setores", {
        method: "PATCH",
        body: JSON.stringify({ id: editingId, payload: updatedSetor }),
      });

      if (!response?.ok || !result.setor) {
        setFeedback(result.error || "Erro ao atualizar setor.");
        return;
      }

      setSetores((current) => current.map((setor) => (setor.id === editingId ? result.setor as Setor : setor)));
      setEditingId(null);
      setForm(emptyForm);
      setFeedback("Setor atualizado com sucesso.");
      return;
    }

    const nextSetor = {
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim() || "Sem responsável",
      rotinas: 0,
      status: "Ativo",
      descricao: form.descricao.trim() || "Sem descrição cadastrada.",
    };
    const { response, result } = await requestSetoresApi("/api/setores", {
      method: "POST",
      body: JSON.stringify(nextSetor),
    });

    if (!response?.ok || !result.setor) {
      setFeedback(result.error || "Erro ao salvar setor.");
      return;
    }

    setSetores((current) => [...current, result.setor as Setor]);
    setForm(emptyForm);
    setFeedback("Setor cadastrado com sucesso.");
  }

  function editarSetor(setor: Setor) {
    setEditingId(setor.id);
    setForm({
      nome: setor.nome,
      responsavel: setor.responsavel ?? "",
      descricao: setor.descricao ?? "",
    });
  }

  async function excluirSetor(id: string) {
    setFeedback("");
    setIsDeleting(true);
    const { response, result } = await requestSetoresApi(`/api/setores?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setIsDeleting(false);

    if (!response?.ok) {
      setFeedback(result.error || "Erro ao excluir setor.");
      return;
    }

    setSetores((current) => current.filter((setor) => setor.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }

    setDeleteTargetId(null);
    setFeedback("Setor excluído com sucesso.");
  }

  return (
    <ErpChrome>
      <header>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Cadastro</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">Setores</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Cadastre os departamentos do escritório e use esses setores para organizar obrigações, tarefas, responsáveis e indicadores.
          </p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1040px]:grid-cols-1">
        <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid gap-3">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3">
              <svg className="size-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
                <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" />
              </svg>
              <input
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar setor ou responsável"
                type="search"
                value={search}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            {isLoading && (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-center text-xs text-slate-400">
                Carregando setores do Supabase...
              </div>
            )}

            {!isLoading && filteredSetores.map((setor) => (
              <section className="rounded-xl border border-white/10 bg-white/[0.045] p-4" key={setor.nome}>
                <div className="flex items-start justify-between gap-3 max-[560px]:flex-col">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-black text-slate-100">{setor.nome}</h2>
                      <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[10px] font-bold text-sky-100">
                        {setor.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{setor.descricao}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button aria-label="Editar setor" onClick={() => editarSetor(setor)} type="button"><ActionIcon type="edit" /></button>
                    <button aria-label="Excluir setor" onClick={() => setDeleteTargetId(setor.id)} type="button"><ActionIcon type="delete" /></button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
                  <span className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                    <small className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Responsável</small>
                    {setor.responsavel}
                  </span>
                  <span className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                    <small className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Rotinas vinculadas</small>
                    {setor.rotinas}
                  </span>
                </div>
              </section>
            ))}

            {!isLoading && filteredSetores.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 text-center text-xs text-slate-400">
                Nenhum setor encontrado.
              </div>
            )}
          </div>
        </article>

        <aside className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h2 className="text-sm font-black text-slate-100">{editingId ? "Editar setor" : "Cadastrar setor"}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {editingId
              ? "Altere as informações do setor selecionado e salve para atualizar a lista."
              : "Use os setores para direcionar tarefas e obrigações para as equipes certas."}
          </p>

          {feedback && (
            <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">
              {feedback}
            </p>
          )}

          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Nome do setor</span>
              <input
                className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Ex.: Societario"
                value={form.nome}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Responsavel</span>
              <input
                className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) => setForm((current) => ({ ...current, responsavel: event.target.value }))}
                placeholder="Responsavel interno"
                value={form.responsavel}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Descrição</span>
              <textarea
                className="min-h-24 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600"
                onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                placeholder="Quais rotinas pertencem a este setor?"
                value={form.descricao}
              />
            </label>
            <div className="mt-1 grid gap-2">
              <button className="min-h-10 rounded-lg bg-sky-300 px-4 text-xs font-black text-slate-950 shadow-[0_18px_42px_rgba(56,189,248,0.20)]" type="submit">
                {editingId ? "Atualizar setor" : "Salvar setor"}
              </button>
              {editingId && (
                <button
                  className="min-h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-100"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  type="button"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </aside>
      </section>
      <ConfirmDeleteModal
        isDeleting={isDeleting}
        isOpen={Boolean(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) void excluirSetor(deleteTargetId);
        }}
      />
    </ErpChrome>
  );
}
