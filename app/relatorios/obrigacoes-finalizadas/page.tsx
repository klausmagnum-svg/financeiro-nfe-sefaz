"use client";

import { useMemo, useState } from "react";
import ErpChrome from "@/app/components/ErpChrome";

type FinalizacaoRecord = {
  id: string;
  finalizacaoKey: string;
  obrigacaoId: string;
  obrigacaoNome: string;
  clienteId: string;
  clienteNome: string;
  dataVencimento: string;
  dataVencimentoLabel: string;
  finalizadoEm: string;
  finalizadoPorId: string;
  finalizadoPorNome: string;
};

const finalizationHistoryStorageKey = "tf-dashboard-obrigacoes-finalizacoes";
const recordsPerPage = 100;

function formatDateTime(value: string) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function loadRecords() {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(finalizationHistoryStorageKey);
    return stored ? JSON.parse(stored) as FinalizacaoRecord[] : [];
  } catch {
    return [];
  }
}

export default function ObrigacoesFinalizadasPage() {
  const [records] = useState<FinalizacaoRecord[]>(() => loadRecords());
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRecords = useMemo(() => {
    const searchText = search.toLowerCase();

    return records.filter((record) =>
      `${record.obrigacaoNome} ${record.clienteNome} ${record.finalizadoPorNome} ${record.dataVencimentoLabel} ${formatDateTime(record.finalizadoEm)}`
        .toLowerCase()
        .includes(searchText)
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / recordsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * recordsPerPage;
    return filteredRecords.slice(start, start + recordsPerPage);
  }, [safeCurrentPage, filteredRecords]);

  return (
    <ErpChrome>
      <header>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Relatórios</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">Obrigações finalizadas</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Acompanhe quais obrigações foram finalizadas, por qual usuário e em qual data.
          </p>
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3">
          <svg className="size-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" />
          </svg>
          <input
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por obrigação, cliente, usuário ou data"
            type="search"
            value={search}
          />
        </label>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[minmax(160px,1fr)_minmax(190px,1.2fr)_120px_160px_150px] bg-white/[0.06] text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 max-[900px]:hidden">
            <span className="px-3 py-3">Obrigacao</span>
            <span className="px-3 py-3">Cliente</span>
            <span className="px-3 py-3">Vencimento</span>
            <span className="px-3 py-3">Finalizado por</span>
            <span className="px-3 py-3 text-right">Data finalização</span>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Nenhuma obrigação finalizada encontrada.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {paginatedRecords.map((record) => (
                <article
                  className="grid grid-cols-[minmax(160px,1fr)_minmax(190px,1.2fr)_120px_160px_150px] items-center text-xs text-slate-300 max-[900px]:grid-cols-1 max-[900px]:gap-2 max-[900px]:p-3"
                  key={record.id}
                >
                  <strong className="px-3 py-3 text-slate-100 max-[900px]:px-0 max-[900px]:py-0">{record.obrigacaoNome}</strong>
                  <span className="px-3 py-3 max-[900px]:px-0 max-[900px]:py-0">{record.clienteNome}</span>
                  <span className="px-3 py-3 max-[900px]:px-0 max-[900px]:py-0">{record.dataVencimentoLabel}</span>
                  <span className="px-3 py-3 max-[900px]:px-0 max-[900px]:py-0">{record.finalizadoPorNome}</span>
                  <span className="px-3 py-3 text-right text-slate-400 max-[900px]:px-0 max-[900px]:py-0 max-[900px]:text-left">
                    {formatDateTime(record.finalizadoEm)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        {filteredRecords.length > recordsPerPage && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              className="min-h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              Anterior
            </button>
            <span className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              Pagina {safeCurrentPage} de {totalPages}
            </span>
            <button
              className="min-h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              type="button"
            >
              Proxima
            </button>
          </div>
        )}
      </section>
    </ErpChrome>
  );
}
