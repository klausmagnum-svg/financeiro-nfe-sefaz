"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface Cliente {
  id: string;
  razao_social: string;
  identificacao: string;
}

interface Certificado {
  id: string;
  nome: string;
  data_validade: string;
}

interface SyncNFSeModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onSyncComplete?: () => void;
}

export default function SyncNFSeModal({ isOpen, onCancel, onSyncComplete }: SyncNFSeModalProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [selectedCertificadoId, setSelectedCertificadoId] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Carregar clientes ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    async function loadClientes() {
      setIsLoading(true);
      setFeedback("");
      try {
        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase nao configurado");

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await supabase
          .from("clientes")
          .select("id,razao_social,identificacao")
          .eq("status", "Ativo")
          .order("razao_social", { ascending: true });

        if (error) throw error;
        setClientes(data ?? []);
        setSelectedClienteId("");
        setCertificados([]);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(`Erro ao carregar clientes: ${error instanceof Error ? error.message : "Desconhecido"}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadClientes();
  }, [isOpen, supabaseUrl, supabaseAnonKey]);

  // Carregar certificados quando cliente é selecionado
  useEffect(() => {
    if (!selectedClienteId) {
      setCertificados([]);
      return;
    }

    async function loadCertificados() {
      setFeedback("");
      try {
        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase nao configurado");

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData?.session?.access_token) throw new Error("Sessao nao encontrada");

        const response = await fetch(`/api/clientes/certificados?clienteId=${selectedClienteId}`, {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao buscar certificados");
        }

        const data = await response.json();
        const ativeCerts = (data.certificados ?? []).filter(
          (c: any) => c.ativo && (!c.data_validade || new Date(c.data_validade) > new Date())
        );

        setCertificados(ativeCerts);
        setSelectedCertificadoId("");
      } catch (error) {
        setFeedbackType("error");
        setFeedback(`Erro ao carregar certificados: ${error instanceof Error ? error.message : "Desconhecido"}`);
        setCertificados([]);
      }
    }

    loadCertificados();
  }, [selectedClienteId, supabaseUrl, supabaseAnonKey]);

  async function handleSync() {
    if (!selectedClienteId || !selectedCertificadoId) {
      setFeedbackType("error");
      setFeedback("Selecione cliente e certificado");
      return;
    }

    setIsSyncing(true);
    setFeedback("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase nao configurado");

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session?.access_token) throw new Error("Sessao nao encontrada");

      const response = await fetch("/api/clientes/sincronizar-nfse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clienteId: selectedClienteId,
          certificadoId: selectedCertificadoId,
          tipo_documento: "NFSe",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.erro || "Erro na sincronizacao");
      }

      setFeedbackType("success");
      setFeedback(data.mensagem || "Sincronizacao iniciada com sucesso! Estrutura de pastas criada no Google Drive.");

      // Fechar modal automaticamente apenas em caso de sucesso
      setTimeout(() => {
        onCancel();
        onSyncComplete?.();
      }, 3000);
    } catch (error) {
      setFeedbackType("error");
      setFeedback(`Erro: ${error instanceof Error ? error.message : "Desconhecido"}`);
    } finally {
      setIsSyncing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/78 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#061020] p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-100">Sincronizar NFS-es Recebidas</h2>
            <p className="mt-1 text-xs text-slate-400">Selecione o cliente e certificado para sincronizar</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sky-100 text-sm">Carregando clientes...</div>
        ) : (
          <div className="space-y-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Cliente</span>
              <select
                className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none disabled:opacity-60"
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                disabled={isSyncing}
              >
                <option value="">Selecione um cliente...</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razao_social} ({cliente.identificacao})
                  </option>
                ))}
              </select>
            </label>

            {selectedClienteId && (
              <>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Certificado</span>
                  <select
                    className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none disabled:opacity-60"
                    value={selectedCertificadoId}
                    onChange={(e) => setSelectedCertificadoId(e.target.value)}
                    disabled={isSyncing}
                  >
                    <option value="">Selecione um certificado...</option>
                    {certificados.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {feedback && (
              <div
                className={`rounded-lg border px-3 py-3 text-xs max-h-32 overflow-y-auto ${
                  feedbackType === "success"
                    ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                    : "border-rose-300/25 bg-rose-300/10 text-rose-100"
                }`}
              >
                {feedback}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="min-h-9 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-200 transition hover:border-sky-300/40 hover:text-sky-100 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onCancel}
            disabled={isSyncing}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="min-h-9 rounded-lg bg-sky-300 px-4 text-xs font-black text-slate-950 transition hover:bg-sky-200 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleSync}
            disabled={!selectedClienteId || !selectedCertificadoId || isSyncing || isLoading}
            type="button"
          >
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </section>
    </div>
  );
}
