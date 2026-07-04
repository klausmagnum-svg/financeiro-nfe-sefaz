"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

type Obrigacao = {
  id: string;
  nome: string;
  validacao: boolean | null;
  regime: string | null;
  periodicidade: string | null;
  prazo: string | null;
  setor: string | null;
  status: string | null;
};

const periodicidadeOrder = ["Mensal", "Quinzenal", "Decendial", "Trimestral", "Semestral", "Anual"];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function getTone(periodicidade: string) {
  if (periodicidade === "Mensal") return "border-sky-300/25 bg-sky-300/10 text-sky-200";
  if (periodicidade === "Anual") return "border-violet-300/25 bg-violet-300/10 text-violet-200";
  if (periodicidade === "Trimestral" || periodicidade === "Semestral") return "border-blue-300/25 bg-blue-300/10 text-blue-200";
  return "border-amber-300/25 bg-amber-300/10 text-amber-200";
}

export default function DashboardObrigacoes() {
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [search, setSearch] = useState("");
  const [periodicidade, setPeriodicidade] = useState("Todas");
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    async function loadObrigacoes() {
      setIsLoading(true);
      setFeedback("");

      const { data, error } = await supabase
        .from("obrigacoes")
        .select("id,nome,validacao,regime,periodicidade,prazo,setor,status")
        .order("setor", { ascending: true })
        .order("nome", { ascending: true });

      if (error) {
        setFeedback(`Nao foi possivel carregar as obrigacoes: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setObrigacoes(data ?? []);
      setIsLoading(false);
    }

    loadObrigacoes();
  }, []);

  const activeObrigacoes = useMemo(
    () => obrigacoes.filter((obrigacao) => normalizeText(obrigacao.status).toLowerCase() !== "inativo"),
    [obrigacoes]
  );

  const filteredObrigacoes = useMemo(() => {
    const searchText = search.toLowerCase();

    return activeObrigacoes.filter((obrigacao) => {
      const matchesSearch = `${obrigacao.nome} ${obrigacao.setor} ${obrigacao.periodicidade} ${obrigacao.regime}`
        .toLowerCase()
        .includes(searchText);
      const matchesPeriod = periodicidade === "Todas" || normalizeText(obrigacao.periodicidade) === periodicidade;

      return matchesSearch && matchesPeriod;
    });
  }, [activeObrigacoes, periodicidade, search]);

  const groupedBySetor = useMemo(() => {
    return filteredObrigacoes.reduce<Record<string, Obrigacao[]>>((groups, obrigacao) => {
      const setor = normalizeText(obrigacao.setor) || "Sem setor";
      groups[setor] = groups[setor] ?? [];
      groups[setor].push(obrigacao);
      return groups;
    }, {});
  }, [filteredObrigacoes]);

  const stats = useMemo(() => {
    const setores = new Set(activeObrigacoes.map((obrigacao) => normalizeText(obrigacao.setor) || "Sem setor"));
    const comValidacao = activeObrigacoes.filter((obrigacao) => obrigacao.validacao).length;
    const mensais = activeObrigacoes.filter((obrigacao) => normalizeText(obrigacao.periodicidade) === "Mensal").length;

    return [
      { label: "Obrigacoes ativas", value: String(activeObrigacoes.length), hint: "Base cadastrada no ERP", tone: "text-sky-300" },
      { label: "Setores envolvidos", value: String(setores.size), hint: "Distribuicao operacional", tone: "text-blue-300" },
      { label: "Com validacao", value: String(comValidacao), hint: "Exigem conferencia antes da entrega", tone: "text-violet-300" },
      { label: "Recorrencia mensal", value: String(mensais), hint: "Maior volume da rotina", tone: "text-amber-300" },
    ];
  }, [activeObrigacoes]);

  const insights = useMemo(() => {
    const setorEntries = Object.entries(groupedBySetor).sort((a, b) => b[1].length - a[1].length);
    const maiorSetor = setorEntries[0];
    const semPrazo = activeObrigacoes.filter((obrigacao) => !normalizeText(obrigacao.prazo)).length;
    const semSetor = activeObrigacoes.filter((obrigacao) => !normalizeText(obrigacao.setor)).length;

    return [
      {
        title: maiorSetor ? `Maior carga: ${maiorSetor[0]}` : "Carga por setor",
        detail: maiorSetor
          ? `${maiorSetor[1].length} obrigacoes estao concentradas nesse setor. Vale acompanhar capacidade e redistribuicao.`
          : "Cadastre setores nas obrigacoes para acompanhar gargalos por equipe.",
        tone: "text-sky-300",
      },
      {
        title: "Qualidade do cadastro",
        detail: semPrazo > 0 ? `${semPrazo} obrigacoes ainda estao sem prazo preenchido.` : "Todas as obrigacoes ativas possuem prazo informado.",
        tone: semPrazo > 0 ? "text-amber-300" : "text-emerald-300",
      },
      {
        title: "Governanca da rotina",
        detail: semSetor > 0 ? `${semSetor} obrigacoes precisam de setor responsavel.` : "Todas as obrigacoes ativas possuem setor responsavel.",
        tone: semSetor > 0 ? "text-rose-300" : "text-blue-300",
      },
    ];
  }, [activeObrigacoes, groupedBySetor]);

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 max-[760px]:flex-col">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Obrigacoes cadastradas</p>
          <h2 className="mt-2 text-xl font-black">Mapa operacional das entregas</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Uma visao por setor, periodicidade e prazo para transformar o cadastro de obrigacoes em fila de trabalho.
          </p>
        </div>
        <Link
          className="flex min-h-9 items-center justify-center rounded-lg bg-sky-300 px-3 text-xs font-black text-slate-950 shadow-[0_18px_42px_rgba(56,189,248,0.18)]"
          href="/cadastros/obrigacoes"
        >
          Gerenciar obrigacoes
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
        {stats.map((stat) => (
          <article className="rounded-xl border border-white/10 bg-white/[0.05] p-3" key={stat.label}>
            <p className="text-[11px] text-slate-400">{stat.label}</p>
            <strong className={`mt-2 block text-2xl font-black ${stat.tone}`}>{stat.value}</strong>
            <span className="mt-1 block text-[11px] text-slate-500">{stat.hint}</span>
          </article>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] gap-3 max-[760px]:grid-cols-1">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3">
          <svg className="size-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" />
          </svg>
          <input
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar obrigacao, setor, regime ou prazo"
            type="search"
            value={search}
          />
        </label>
        <select
          className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 outline-none"
          onChange={(event) => setPeriodicidade(event.target.value)}
          value={periodicidade}
        >
          <option>Todas</option>
          {periodicidadeOrder.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      {feedback && <p className="mt-3 rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{feedback}</p>}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_320px] gap-4 max-[1120px]:grid-cols-1">
        <div className="max-h-[680px] overflow-auto rounded-xl border border-white/10 bg-slate-950/45">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400">Carregando obrigacoes cadastradas...</div>
          ) : Object.keys(groupedBySetor).length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Nenhuma obrigacao encontrada para os filtros atuais.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {Object.entries(groupedBySetor).map(([setor, items]) => (
                <section className="p-3" key={setor}>
                  <div className="sticky top-0 z-10 -mx-3 -mt-3 flex items-center justify-between gap-3 border-b border-white/10 bg-[#061020]/95 px-3 py-2 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-full bg-sky-300/15 text-[11px] font-black text-sky-200">
                        {items.length}
                      </span>
                      <strong className="text-xs text-slate-100">{setor}</strong>
                    </div>
                    <span className="text-[11px] text-slate-500">Setor responsavel</span>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {items.map((obrigacao) => {
                      const itemPeriodicidade = normalizeText(obrigacao.periodicidade) || "Sem periodicidade";

                      return (
                        <article
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:border-sky-300/25 hover:bg-white/[0.06] max-[720px]:grid-cols-1"
                          key={obrigacao.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="grid size-5 place-items-center rounded-full bg-sky-300 text-[10px] font-black text-slate-950">
                                +
                              </span>
                              <strong className="truncate text-xs text-sky-100">{obrigacao.nome}</strong>
                              {obrigacao.validacao && (
                                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                                  validacao
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{normalizeText(obrigacao.regime) || "Sem regime informado"}</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] max-[720px]:justify-start">
                            <span className={`rounded-full border px-2 py-1 font-bold ${getTone(itemPeriodicidade)}`}>{itemPeriodicidade}</span>
                            <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-slate-300">
                              Prazo: {normalizeText(obrigacao.prazo) || "nao informado"}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="grid content-start gap-3">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-black">Insights automaticos</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Pontos que ajudam a priorizar ajustes no cadastro e na operacao.</p>
            <div className="mt-3 grid gap-2">
              {insights.map((insight) => (
                <article className="rounded-lg border border-white/10 bg-slate-950/55 p-3" key={insight.title}>
                  <strong className={`text-xs ${insight.tone}`}>{insight.title}</strong>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{insight.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <h3 className="text-sm font-black">Boas ideias para evoluir</h3>
            <div className="mt-3 grid gap-2 text-[11px] leading-5 text-slate-300">
              <p className="rounded-lg border border-white/10 bg-slate-950/55 p-2">Criar alerta por prazo critico antes da competencia vencer.</p>
              <p className="rounded-lg border border-white/10 bg-slate-950/55 p-2">Gerar tarefas automaticas por setor a partir da periodicidade cadastrada.</p>
              <p className="rounded-lg border border-white/10 bg-slate-950/55 p-2">Mostrar obrigacoes sem prazo, sem setor ou sem validacao como pendencias do cadastro.</p>
              <p className="rounded-lg border border-white/10 bg-slate-950/55 p-2">Criar uma visao por regime tributario para conferir se cada cliente recebe a rotina certa.</p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
