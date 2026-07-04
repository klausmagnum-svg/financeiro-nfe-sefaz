"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ErpChrome from "@/app/components/ErpChrome";
import { supabase } from "@/app/lib/supabaseClient";

const regimes = [
  "CEI",
  "Empresa Rural",
  "Imune - Isenta",
  "Inativas",
  "Lucro Presumido",
  "Lucro Real",
  "MEI",
  "Pessoa Fisica",
  "RET",
  "Simples Nacional",
  "Simples Nacional Sublimite ICMS e ISS",
];

const tiposCompetencia = ["Anual", "Semestral", "Trimestral", "Mensal", "Quinzenal", "Decendial"];
const anosCompetencia = ["2026", "2027", "2028", "2029", "2030"];
const meses = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const tiposPrazo = ["Dia fixo no mes", "Quantidade dias uteis"];
const tiposPrazoAposCompetencia = ["Dias apos competencia", "Quantidade dias uteis apos competencia"];
const semestres = ["1 Semestre", "2 Semestre"];
const trimestres = ["1 Trimestre", "2 Trimestre", "3 Trimestre", "4 Trimestre"];
const ajustesPrazo = ["Manter prazo de vencimento", "Antecipar prazo de vencimento", "Postergar prazo de vencimento"];
const anexos = ["Nao validar", "Opcional", "Obrigatorio"];
const estadosBrasil = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

const emptyObrigacao = {
  nome: "",
  tipoEvento: "Selecione o tipo (opcional)",
  esfera: "Federal",
  estadoMunicipal: "",
  municipio: "",
  matrizFilial: "Matriz",
  setor: "",
  baseLegal: "",
  tipoCompetencia: "Mensal",
  competenciaAno: "2026",
  mes: "Janeiro",
  dias: "",
  mesesSubsequentes: "",
  dataInicio: "",
  regimes: [] as string[],
  tipoPrazo: "Dia fixo no mes",
  prazoUtil: "Manter prazo de vencimento",
  exigirAnexo: "Nao validar",
  estados: [] as string[],
  instrucoes: "",
  mensagemPadrao: "",
};

type SetorOption = {
  id: string;
  nome: string;
};

type MunicipioOption = {
  id: number;
  nome: string;
};

type ObrigacaoDetalhe = {
  nome?: string;
  tipo_evento?: string;
  esfera?: string;
  matriz_filial?: string;
  setor?: string;
  base_legal?: string;
  tipo_competencia?: string;
  periodicidade?: string;
  competencia?: string;
  mes?: string;
  dias?: string;
  prazo?: string;
  meses_subsequentes?: string;
  data_inicio?: string;
  regimes?: string[];
  tipo_prazo?: string;
  ajuste_prazo?: string;
  prazo_util?: string;
  exigir_anexo?: string;
  estados?: string[];
  instrucoes?: string;
  mensagem_padrao?: string;
  regras_vencimento?: RegraVencimento[];
  periodicidade_config?: { localizacao?: { estadoMunicipal?: string; municipio?: string } };
};

type ObrigacaoApiResponse = {
  setores?: SetorOption[];
  obrigacao?: ObrigacaoDetalhe;
  error?: string;
};

type RegraVencimento = {
  id: string;
  competencia: string;
  mes?: string;
  dia: string;
  mesesSubsequentes?: string;
  tipo: string;
};

type VencimentoDraft = {
  competenciaAno: string;
  periodo: string;
  mes: string;
  dia: string;
  mesesSubsequentes: string;
  tipoPrazo: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function formatDateTyping(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function todayIsoDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function isoToDisplayDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return formatDateTyping(value);
  return `${day}/${month}/${year}`;
}

function displayToIsoDate(value: string) {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year || year.length !== 4) return todayIsoDate();
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isValidDisplayDate(value: string) {
  if (!value) return true;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;

  const [day, month, year] = value.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

async function requestObrigacaoApi(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      response: null,
      result: { error: "Sessão não encontrada. Entre novamente no sistema." } as ObrigacaoApiResponse,
    };
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const result = await response.json().catch(() => ({} as ObrigacaoApiResponse));
  return { response, result };
}

export default function ObrigacaoForm({ mode }: { mode: "edit" | "create" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = mode === "edit";
  const editingId = searchParams.get("id");
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(emptyObrigacao);
  const [vencimentoDraft, setVencimentoDraft] = useState<VencimentoDraft>({
    competenciaAno: "2026",
    periodo: "1 Semestre",
    mes: "Janeiro",
    dia: "",
    mesesSubsequentes: "1",
    tipoPrazo: "Dia fixo no mes",
  });
  const [regrasVencimento, setRegrasVencimento] = useState<RegraVencimento[]>([]);
  const [setores, setSetores] = useState<SetorOption[]>([]);
  const [municipiosEstado, setMunicipiosEstado] = useState<MunicipioOption[]>([]);
  const [isLoadingSetores, setIsLoadingSetores] = useState(true);
  const [isLoadingMunicipios, setIsLoadingMunicipios] = useState(false);
  const [isLoadingObrigacao, setIsLoadingObrigacao] = useState(isEdit);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSetores() {
      setIsLoadingSetores(true);
      const { response, result } = await requestObrigacaoApi("/api/setores");

      setIsLoadingSetores(false);

      if (!response?.ok) {
        setFeedback(result.error || "Erro ao buscar setores.");
        return;
      }

      const loadedSetores = result.setores ?? [];
      setSetores(loadedSetores);

      if (loadedSetores.length > 0) {
        setData((current) => ({
          ...current,
          setor: current.setor || loadedSetores[0].nome,
        }));
      }
    }

    loadSetores();
  }, []);

  useEffect(() => {
    async function loadObrigacao() {
      if (!isEdit) {
        setIsLoadingObrigacao(false);
        return;
      }

      if (!editingId) {
        setFeedback("Obrigação não encontrada para edição.");
        setIsLoadingObrigacao(false);
        return;
      }

      setIsLoadingObrigacao(true);
      const { response, result } = await requestObrigacaoApi(`/api/obrigacoes?id=${encodeURIComponent(editingId)}`);

      setIsLoadingObrigacao(false);

      if (!response?.ok || !result.obrigacao) {
        setFeedback(result.error || "Erro ao buscar obrigação.");
        return;
      }

      const obrigacao = result.obrigacao;
      const tipoCompetencia = obrigacao.tipo_competencia || obrigacao.periodicidade || "Mensal";
      const savedRegras = Array.isArray(obrigacao.regras_vencimento)
        ? obrigacao.regras_vencimento as RegraVencimento[]
        : [];
      const fallbackRegra: RegraVencimento = {
        id: "regra-carregada",
        competencia: obrigacao.competencia || tipoCompetencia,
        mes: obrigacao.mes || undefined,
        dia: obrigacao.dias || obrigacao.prazo || "",
        mesesSubsequentes: obrigacao.meses_subsequentes || undefined,
        tipo: obrigacao.tipo_prazo || "Dia fixo no mes",
      };
      const regrasCarregadas = savedRegras.length > 0 ? savedRegras : fallbackRegra.dia ? [fallbackRegra] : [];
      const primeiraRegra = regrasCarregadas[0] || fallbackRegra;
      const usesTabelaRegras = ["Anual", "Semestral", "Trimestral"].includes(tipoCompetencia);

      const periodicidadeConfig = obrigacao.periodicidade_config && typeof obrigacao.periodicidade_config === "object"
        ? obrigacao.periodicidade_config as { localizacao?: { estadoMunicipal?: string; municipio?: string } }
        : {};

      setData({
        nome: obrigacao.nome || "",
        tipoEvento: obrigacao.tipo_evento || "Selecione o tipo (opcional)",
        esfera: obrigacao.esfera || "Federal",
        estadoMunicipal: periodicidadeConfig.localizacao?.estadoMunicipal || "",
        municipio: periodicidadeConfig.localizacao?.municipio || "",
        matrizFilial: obrigacao.matriz_filial || "Matriz",
        setor: obrigacao.setor || "",
        baseLegal: obrigacao.base_legal || "",
        tipoCompetencia,
        competenciaAno: obrigacao.competencia || "2026",
        mes: obrigacao.mes || "Janeiro",
        dias: obrigacao.dias || obrigacao.prazo || "",
        mesesSubsequentes: obrigacao.meses_subsequentes || "",
        dataInicio: obrigacao.data_inicio?.includes("-") ? isoToDisplayDate(obrigacao.data_inicio) : formatDateTyping(obrigacao.data_inicio || ""),
        regimes: Array.isArray(obrigacao.regimes) ? obrigacao.regimes : [],
        tipoPrazo: obrigacao.tipo_prazo || "Dia fixo no mes",
        prazoUtil: obrigacao.ajuste_prazo || obrigacao.prazo_util || "Manter prazo de vencimento",
        exigirAnexo: obrigacao.exigir_anexo || "Nao validar",
        estados: Array.isArray(obrigacao.estados) ? obrigacao.estados : [],
        instrucoes: obrigacao.instrucoes || "",
        mensagemPadrao: obrigacao.mensagem_padrao || "",
      });

      setRegrasVencimento(usesTabelaRegras ? regrasCarregadas : []);
      setVencimentoDraft({
        competenciaAno: obrigacao.competencia?.slice(0, 4) || "2026",
        periodo: tipoCompetencia === "Trimestral"
          ? primeiraRegra.competencia || "1 Trimestre"
          : obrigacao.competencia?.endsWith("/2")
            ? "2 Semestre"
            : "1 Semestre",
        mes: primeiraRegra.mes || obrigacao.mes || "Janeiro",
        dia: usesTabelaRegras ? "" : primeiraRegra.dia || "",
        mesesSubsequentes: primeiraRegra.mesesSubsequentes || obrigacao.meses_subsequentes || (tipoCompetencia === "Mensal" ? "12" : "1"),
        tipoPrazo: primeiraRegra.tipo || obrigacao.tipo_prazo || (tipoCompetencia === "Quinzenal" || tipoCompetencia === "Decendial" ? "Dias apos competencia" : "Dia fixo no mes"),
      });
    }

    loadObrigacao();
  }, [editingId, isEdit]);

  useEffect(() => {
    let isActive = true;

    async function loadMunicipios() {
      if (data.esfera !== "Municipal" || !data.estadoMunicipal || data.estadoMunicipal === "Todos") {
        if (isActive) {
          setMunicipiosEstado([]);
          setIsLoadingMunicipios(false);
        }
        return;
      }

      setIsLoadingMunicipios(true);

      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.estadoMunicipal}/municipios`);
        if (!response.ok) throw new Error("Nao foi possivel carregar municipios.");

        const municipios = await response.json() as MunicipioOption[];
        const municipiosOrdenados = municipios
          .map((municipio) => ({ id: municipio.id, nome: municipio.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        if (!isActive) return;

        setMunicipiosEstado(municipiosOrdenados);
        setData((current) => {
          if (current.esfera !== "Municipal" || current.estadoMunicipal !== data.estadoMunicipal) return current;
          if (!current.municipio || current.municipio === "Todos") return { ...current, municipio: "Todos" };

          const municipioExiste = municipiosOrdenados.some((municipio) => municipio.nome === current.municipio);
          return municipioExiste ? current : { ...current, municipio: "Todos" };
        });
      } catch {
        if (isActive) {
          setMunicipiosEstado([]);
          setData((current) => current.esfera === "Municipal" ? { ...current, municipio: "Todos" } : current);
        }
      } finally {
        if (isActive) setIsLoadingMunicipios(false);
      }
    }

    loadMunicipios();

    return () => {
      isActive = false;
    };
  }, [data.esfera, data.estadoMunicipal]);

  function updateField(field: keyof typeof emptyObrigacao, value: string) {
    setData((current) => {
      if (field === "esfera") {
        return {
          ...current,
          esfera: value,
          estados: value === "Estadual" ? current.estados : [],
          estadoMunicipal: value === "Municipal" ? current.estadoMunicipal || "Todos" : "",
          municipio: value === "Municipal" ? current.municipio || "Todos" : "",
        };
      }

      if (field === "estadoMunicipal") {
        return {
          ...current,
          estadoMunicipal: value,
          municipio: "Todos",
        };
      }

      return { ...current, [field]: value };
    });
  }

  function openDataInicioPicker() {
    const input = datePickerRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  }

  function updateTipoCompetencia(value: string) {
    setData((current) => ({ ...current, tipoCompetencia: value }));
    setRegrasVencimento([]);
    setVencimentoDraft((current) => ({
      ...current,
      periodo: value === "Trimestral" ? "1 Trimestre" : "1 Semestre",
      tipoPrazo: value === "Quinzenal" || value === "Decendial" ? "Dias apos competencia" : "Dia fixo no mes",
      dia: "",
      mesesSubsequentes: value === "Mensal" ? "12" : value === "Trimestral" ? "3" : current.mesesSubsequentes,
    }));
  }

  function updateVencimentoDraft(field: keyof VencimentoDraft, value: string) {
    setVencimentoDraft((current) => ({ ...current, [field]: value }));
  }

  function getCompetenciaLabel() {
    if (data.tipoCompetencia === "Anual") {
      return vencimentoDraft.competenciaAno;
    }

    if (data.tipoCompetencia === "Semestral") {
      return `${vencimentoDraft.competenciaAno}/${vencimentoDraft.periodo.startsWith("1") ? "1" : "2"}`;
    }

    return vencimentoDraft.periodo;
  }

  function addRegraVencimento() {
    setFeedback("");

    if (!vencimentoDraft.dia.trim()) {
      setFeedback("Informe o dia da regra de vencimento.");
      return;
    }

    const regra: RegraVencimento = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      competencia: getCompetenciaLabel(),
      dia: vencimentoDraft.dia.trim(),
      tipo: vencimentoDraft.tipoPrazo,
    };

    if (data.tipoCompetencia === "Anual" || data.tipoCompetencia === "Semestral") {
      regra.mes = vencimentoDraft.mes;
    }

    if (data.tipoCompetencia === "Trimestral") {
      regra.mesesSubsequentes = vencimentoDraft.mesesSubsequentes || "3";
    }

    setRegrasVencimento((current) => [...current, regra]);
    setVencimentoDraft((current) => ({ ...current, dia: "" }));
  }

  function removeRegraVencimento(id: string) {
    setRegrasVencimento((current) => current.filter((regra) => regra.id !== id));
  }

  function toggleRegime(regime: string, checked: boolean) {
    setData((current) => ({
      ...current,
      regimes: checked
        ? [...current.regimes, regime]
        : current.regimes.filter((item) => item !== regime),
    }));
  }

  function toggleEstado(estado: string, checked: boolean) {
    setData((current) => ({
      ...current,
      estados: checked
        ? [...current.estados, estado]
        : current.estados.filter((item) => item !== estado),
    }));
  }

  function toggleTodosEstados() {
    setData((current) => ({
      ...current,
      estados: current.estados.length === estadosBrasil.length ? [] : estadosBrasil,
    }));
  }

  function buildRegrasResumo() {
    return [
      `Competência: ${data.competenciaAno}`,
      `Tipo de competência: ${data.tipoCompetencia}`,
      `Prazo: ${data.tipoPrazo}`,
      `Mes: ${data.mes}`,
      `Dia(s): ${data.dias || "Não informado"}`,
      `Regras de vencimento: ${JSON.stringify(regrasVencimento)}`,
      `Quando não for dia útil: ${data.prazoUtil}`,
      `Estados: ${data.estados.join(", ") || "Não informado"}`,
      `Exigir anexo: ${data.exigirAnexo}`,
    ].join("\n");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!data.nome.trim()) {
      setFeedback("Informe o nome da obrigação.");
      return;
    }

    if (!data.setor) {
      setFeedback("Cadastre um setor antes de salvar a obrigação.");
      return;
    }

    if (isEdit && !editingId) {
      setFeedback("Obrigação não encontrada para atualizar.");
      return;
    }

    const usesTabelaRegras = ["Anual", "Semestral", "Trimestral"].includes(data.tipoCompetencia);
    if (usesTabelaRegras && regrasVencimento.length === 0) {
      setFeedback("Adicione pelo menos uma regra de vencimento para esta competencia.");
      return;
    }

    if (!usesTabelaRegras && !vencimentoDraft.dia.trim()) {
      setFeedback("Informe o dia da regra de vencimento.");
      return;
    }

    if (!isValidDisplayDate(data.dataInicio)) {
      setFeedback("Informe a data inicio controle no formato dd/mm/aaaa.");
      return;
    }

    const regraUnica: RegraVencimento = {
      id: "regra-unica",
      competencia: data.tipoCompetencia,
      dia: vencimentoDraft.dia.trim(),
      mesesSubsequentes: data.tipoCompetencia === "Mensal" ? vencimentoDraft.mesesSubsequentes : undefined,
      tipo: vencimentoDraft.tipoPrazo,
    };
    const regrasParaSalvar: RegraVencimento[] = usesTabelaRegras ? regrasVencimento : [regraUnica];
    const primeiraRegra = regrasParaSalvar[0];

    setIsSaving(true);
    const payload = {
      nome: data.nome.trim(),
      validacao: data.exigirAnexo === "Obrigatorio" || data.exigirAnexo === "Opcional",
      regime: data.regimes.join(", ") || "Nao informado",
      periodicidade: data.tipoCompetencia.trim() || "Nao informado",
      prazo: primeiraRegra?.dia || "Nao informado",
      setor: data.setor,
      tipo_evento: data.tipoEvento,
      esfera: data.esfera,
      matriz_filial: data.matrizFilial,
      base_legal: data.baseLegal,
      tipo_competencia: data.tipoCompetencia,
      competencia: primeiraRegra?.competencia || vencimentoDraft.competenciaAno,
      mes: primeiraRegra?.mes || vencimentoDraft.mes,
      dias: primeiraRegra?.dia || vencimentoDraft.dia,
      meses_subsequentes: primeiraRegra?.mesesSubsequentes || vencimentoDraft.mesesSubsequentes,
      data_inicio: data.dataInicio,
      regimes: data.regimes,
      tipo_prazo: primeiraRegra?.tipo || vencimentoDraft.tipoPrazo,
      prazo_util: data.prazoUtil,
      exigir_anexo: data.exigirAnexo,
      ajuste_prazo: data.prazoUtil,
      estados: data.esfera === "Estadual" ? data.estados : [],
      regras_vencimento: regrasParaSalvar,
      periodicidade_config: {
        tipoCompetencia: data.tipoCompetencia,
        regraUnica: !usesTabelaRegras,
        regras: regrasParaSalvar,
        localizacao: {
          estadoMunicipal: data.esfera === "Municipal" ? data.estadoMunicipal : "",
          municipio: data.esfera === "Municipal" ? data.municipio.trim() : "",
          estados: data.esfera === "Estadual" ? data.estados : [],
        },
      },
      instrucoes: data.instrucoes,
      mensagem_padrao: data.mensagemPadrao,
      status: "Ativo",
    };

    const saveRequest = isEdit && editingId
      ? await requestObrigacaoApi("/api/obrigacoes", {
        method: "PATCH",
        body: JSON.stringify({ id: editingId, payload }),
      })
      : await requestObrigacaoApi("/api/obrigacoes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    let errorMessage = saveRequest.response?.ok ? "" : saveRequest.result.error || "Erro ao salvar obrigação.";

    if (errorMessage.toLowerCase().includes("column")) {
      const regrasResumo = buildRegrasResumo();
      const fallbackPayload = {
        nome: payload.nome,
        validacao: payload.validacao,
        regime: payload.regime,
        periodicidade: payload.periodicidade,
        prazo: payload.prazo,
        setor: payload.setor,
        tipo_evento: payload.tipo_evento,
        esfera: payload.esfera,
        matriz_filial: payload.matriz_filial,
        base_legal: payload.base_legal,
        tipo_competencia: payload.tipo_competencia,
        dias: payload.dias,
        meses_subsequentes: payload.meses_subsequentes,
        data_inicio: payload.data_inicio,
        regimes: payload.regimes,
        tipo_prazo: payload.tipo_prazo,
        prazo_util: payload.prazo_util,
        exigir_anexo: payload.exigir_anexo,
        regras_vencimento: payload.regras_vencimento,
        periodicidade_config: payload.periodicidade_config,
        instrucoes: [data.instrucoes.trim(), regrasResumo].filter(Boolean).join("\n\n"),
        mensagem_padrao: payload.mensagem_padrao,
        status: payload.status,
      };

      const retry = isEdit && editingId
        ? await requestObrigacaoApi("/api/obrigacoes", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, payload: fallbackPayload }),
        })
        : await requestObrigacaoApi("/api/obrigacoes", {
          method: "POST",
          body: JSON.stringify(fallbackPayload),
        });
      errorMessage = retry.response?.ok ? "" : retry.result.error || "Erro ao salvar obrigação.";
    }

    setIsSaving(false);

    if (errorMessage) {
      setFeedback(`Erro ao salvar obrigação: ${errorMessage}`);
      return;
    }

    router.push("/cadastros/obrigacoes");
  }

  return (
    <ErpChrome>
      <form onSubmit={handleSubmit}>
        <header>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Cadastro / Obrigações</p>
            <h1 className="mt-1 text-2xl font-black leading-tight">
              {isEdit ? "Editar obrigação fiscal" : "Nova obrigação fiscal"}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
              Cadastre uma nova obrigação para alimentar agenda fiscal, tarefas recorrentes, SLA e rotinas dos setores.
            </p>
          </div>
        </header>

        {feedback && <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{feedback}</p>}
        {isLoadingObrigacao && <p className="mt-4 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">Carregando dados da obrigação...</p>}

        <section className="mt-5 grid gap-4">
          <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 max-[640px]:flex-col max-[640px]:items-start">
              <div>
                <h2 className="text-sm font-black text-slate-100">Dados principais</h2>
                <p className="mt-1 text-xs text-slate-500">Identificação, departamento responsável e classificação da obrigação.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
              <Field label="Obrigacao">
                <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" onChange={(event) => updateField("nome", event.target.value)} placeholder="Ex.: DCTF WEB" value={data.nome} />
              </Field>
              <Field label="Tipo de evento">
                <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateField("tipoEvento", event.target.value)} value={data.tipoEvento}>
                  {["Selecione o tipo (opcional)", "Declaracao", "Retificacao", "Encerramento"].map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Esfera">
                <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateField("esfera", event.target.value)} value={data.esfera}>
                  {["Federal", "Estadual", "Municipal"].map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              {data.esfera === "Municipal" && (
                <>
                  <Field label="Estado">
                    <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateField("estadoMunicipal", event.target.value)} value={data.estadoMunicipal}>
                      <option value="Todos">Todos</option>
                      {estadosBrasil.map((estado) => <option key={estado}>{estado}</option>)}
                    </select>
                  </Field>
                  <Field label="Municipio">
                    <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45 disabled:opacity-60" disabled={isLoadingMunicipios} onChange={(event) => updateField("municipio", event.target.value)} value={data.municipio || "Todos"}>
                      <option value="Todos">{isLoadingMunicipios ? "Carregando municipios..." : "Todos"}</option>
                      {municipiosEstado.map((municipio) => <option key={municipio.id} value={municipio.nome}>{municipio.nome}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Matriz / Filial">
                <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateField("matrizFilial", event.target.value)} value={data.matrizFilial}>
                  {["Matriz", "Filial", "Ambos"].map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Setor">
                <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45 disabled:opacity-60" disabled={isLoadingSetores || setores.length === 0} onChange={(event) => updateField("setor", event.target.value)} value={data.setor}>
                  {isLoadingSetores && <option value="">Carregando setores...</option>}
                  {!isLoadingSetores && setores.length === 0 && <option value="">Nenhum setor cadastrado</option>}
                  {setores.map((setor) => <option key={setor.id} value={setor.nome}>{setor.nome}</option>)}
                </select>
              </Field>
              <Field label="Base legal">
                <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" onChange={(event) => updateField("baseLegal", event.target.value)} placeholder="Informe a base legal da obrigacao" value={data.baseLegal} />
              </Field>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-sm font-black text-slate-100">Regimes tributários aplicáveis</h2>
            <p className="mt-1 text-xs text-slate-500">Marque os regimes que devem gerar esta obrigação para os clientes vinculados.</p>
            <div className="mt-4 grid grid-cols-5 gap-2 max-[1180px]:grid-cols-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
              {regimes.map((regime) => (
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs text-slate-300" key={regime}>
                  <input checked={data.regimes.includes(regime)} className="accent-sky-300" onChange={(event) => toggleRegime(regime, event.target.checked)} type="checkbox" />
                  {regime}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-sm font-black text-slate-100">Detalhamento e anexos</h2>
            <p className="mt-1 text-xs text-slate-500">Instrução ou observação exibida na finalização da entrega.</p>
            <textarea className="mt-4 min-h-28 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-100 outline-none placeholder:text-slate-600" onChange={(event) => updateField("instrucoes", event.target.value)} placeholder="Digite aqui as instrucoes para a equipe..." value={data.instrucoes} />
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#061020]/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h2 className="text-sm font-black text-slate-100">Competência e periodicidade</h2>
            <p className="mt-1 text-xs text-slate-500">Regras que definem vencimento, recorrência e exigência de arquivo.</p>
            <div className="mt-4 grid grid-cols-6 gap-2 max-[1100px]:grid-cols-3 max-[620px]:grid-cols-2">
              {tiposCompetencia.map((option) => (
                <label
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                    data.tipoCompetencia === option
                      ? "border-sky-300/45 bg-sky-300/12 text-sky-100"
                      : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-sky-300/25"
                  }`}
                  key={option}
                >
                  <input checked={data.tipoCompetencia === option} className="accent-sky-300" onChange={() => updateTipoCompetencia(option)} type="radio" />
                  {option}
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 max-[720px]:flex-col">
                <div>
                  <h3 className="text-xs font-black text-slate-100">Prazo de vencimento</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {["Anual", "Semestral", "Trimestral"].includes(data.tipoCompetencia)
                      ? "Adicione uma ou mais regras e confira a tabela antes de salvar."
                      : "Informe a regra padrao que sera aplicada a cada competencia gerada."}
                  </p>
                </div>
                {["Anual", "Semestral", "Trimestral"].includes(data.tipoCompetencia) && (
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-100">
                    {regrasVencimento.length} regra(s)
                  </span>
                )}
              </div>

              {(data.tipoCompetencia === "Anual" || data.tipoCompetencia === "Semestral") && (
                <div className="mt-3 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
                  <Field label="Competência">
                    <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateVencimentoDraft("competenciaAno", event.target.value)} value={vencimentoDraft.competenciaAno}>
                      {anosCompetencia.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </Field>
                  {data.tipoCompetencia === "Semestral" && (
                    <Field label="Semestre">
                      <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateVencimentoDraft("periodo", event.target.value)} value={vencimentoDraft.periodo}>
                        {semestres.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Mes">
                    <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateVencimentoDraft("mes", event.target.value)} value={vencimentoDraft.mes}>
                      {meses.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {data.tipoCompetencia === "Trimestral" && (
                <div className="mt-3 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
                  <Field label="Competência">
                    <select className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition focus:border-sky-300/45" onChange={(event) => updateVencimentoDraft("periodo", event.target.value)} value={vencimentoDraft.periodo}>
                      {trimestres.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Meses subsequentes">
                    <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" min="0" onChange={(event) => updateVencimentoDraft("mesesSubsequentes", event.target.value)} type="number" value={vencimentoDraft.mesesSubsequentes} />
                  </Field>
                </div>
              )}

              <div className="mt-3 grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Tipo</span>
                <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
                  {(data.tipoCompetencia === "Quinzenal" || data.tipoCompetencia === "Decendial" ? tiposPrazoAposCompetencia : tiposPrazo).map((option) => (
                    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs text-slate-300" key={option}>
                      <input checked={vencimentoDraft.tipoPrazo === option} className="accent-sky-300" onChange={() => updateVencimentoDraft("tipoPrazo", option)} type="radio" />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[minmax(0,220px)_minmax(0,220px)_auto] items-end gap-3 max-[760px]:grid-cols-1">
                <Field label="Dia(s)">
                  <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" onChange={(event) => updateVencimentoDraft("dia", event.target.value)} placeholder={data.tipoCompetencia === "Decendial" ? "Ex.: 30" : "Ex.: 10"} value={vencimentoDraft.dia} />
                </Field>
                {data.tipoCompetencia === "Mensal" && (
                  <Field label="Meses subsequentes">
                    <input className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" min="0" onChange={(event) => updateVencimentoDraft("mesesSubsequentes", event.target.value)} type="number" value={vencimentoDraft.mesesSubsequentes} />
                  </Field>
                )}
                {["Anual", "Semestral", "Trimestral"].includes(data.tipoCompetencia) && (
                  <button className="min-h-10 rounded-lg border border-sky-300/25 bg-sky-300/10 px-4 text-xs font-black text-sky-100 transition hover:border-sky-300/45" onClick={addRegraVencimento} type="button">
                    Adicionar regra
                  </button>
                )}
              </div>

              {["Anual", "Semestral", "Trimestral"].includes(data.tipoCompetencia) && (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                  <div className={`grid ${data.tipoCompetencia === "Trimestral" ? "grid-cols-[1fr_110px_1fr_1fr_86px]" : "grid-cols-[1fr_1fr_110px_1fr_86px]"} bg-white/[0.06] text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 max-[760px]:hidden`}>
                    <span className="px-3 py-2">Competência</span>
                    {data.tipoCompetencia !== "Trimestral" && <span className="px-3 py-2">Mes</span>}
                    <span className="px-3 py-2">Dia</span>
                    {data.tipoCompetencia === "Trimestral" && <span className="px-3 py-2">Meses subsequentes</span>}
                    <span className="px-3 py-2">Tipo</span>
                    <span className="px-3 py-2 text-right">Acao</span>
                  </div>
                  {regrasVencimento.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">Nenhuma regra adicionada.</div>
                  ) : (
                    regrasVencimento.map((regra) => (
                      <div className={`grid ${data.tipoCompetencia === "Trimestral" ? "grid-cols-[1fr_110px_1fr_1fr_86px]" : "grid-cols-[1fr_1fr_110px_1fr_86px]"} items-center border-t border-white/10 text-xs text-slate-300 max-[760px]:grid-cols-1 max-[760px]:gap-1 max-[760px]:px-3 max-[760px]:py-3`} key={regra.id}>
                        <span className="px-3 py-2 max-[760px]:px-0"><strong className="text-slate-100">{regra.competencia}</strong></span>
                        {data.tipoCompetencia !== "Trimestral" && <span className="px-3 py-2 max-[760px]:px-0">{regra.mes}</span>}
                        <span className="px-3 py-2 max-[760px]:px-0">{regra.dia}</span>
                        {data.tipoCompetencia === "Trimestral" && <span className="px-3 py-2 max-[760px]:px-0">{regra.mesesSubsequentes}</span>}
                        <span className="px-3 py-2 max-[760px]:px-0">{regra.tipo}</span>
                        <span className="px-3 py-2 text-right max-[760px]:px-0 max-[760px]:text-left">
                          <button className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-1 text-xs font-black text-rose-200" onClick={() => removeRegraVencimento(regra.id)} type="button">
                            Remover
                          </button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <h3 className="text-xs font-black text-slate-100">Quando o prazo de vencimento não for dia útil?</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 max-[900px]:grid-cols-1">
                {ajustesPrazo.map((option) => (
                  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs text-slate-300" key={option}>
                    <input checked={data.prazoUtil === option} className="accent-sky-300" onChange={() => updateField("prazoUtil", option)} type="radio" />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[220px_minmax(0,1fr)] gap-3 max-[760px]:grid-cols-1">
              <Field label="Data inicio controle">
                <div className="relative grid grid-cols-[minmax(0,1fr)_42px] gap-2">
                  <input
                    className="min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) => updateField("dataInicio", formatDateTyping(event.target.value))}
                    placeholder="dd/mm/aaaa"
                    value={data.dataInicio}
                  />
                  <button
                    aria-label="Abrir calendario"
                    className="grid min-h-10 place-items-center rounded-lg border border-white/10 bg-slate-950/60 text-sky-200 transition hover:border-sky-300/45 hover:bg-sky-300/10"
                    onClick={openDataInicioPicker}
                    title="Abrir calendario"
                    type="button"
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <path d="M3 10h18" />
                      <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                    </svg>
                  </button>
                  <input
                    ref={datePickerRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 top-0 size-px opacity-0"
                    onChange={(event) => updateField("dataInicio", isoToDisplayDate(event.target.value))}
                    tabIndex={-1}
                    type="date"
                    value={data.dataInicio ? displayToIsoDate(data.dataInicio) : todayIsoDate()}
                  />
                </div>
              </Field>
              <Field label="Mensagem padrao">
                <textarea className="min-h-20 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/45" onChange={(event) => updateField("mensagemPadrao", event.target.value)} placeholder="Mensagem padrao para esta obrigacao" value={data.mensagemPadrao} />
              </Field>
            </div>

            {data.esfera === "Estadual" && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center justify-between gap-3 max-[560px]:items-start max-[560px]:flex-col">
                  <div>
                    <h3 className="text-xs font-black text-slate-100">Estados</h3>
                    <p className="mt-1 text-xs text-slate-500">Selecione as UFs em que esta obrigação deve ser aplicada.</p>
                  </div>
                  <button className="min-h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-200 transition hover:border-sky-300/30 hover:text-sky-100" onClick={toggleTodosEstados} type="button">
                    {data.estados.length === estadosBrasil.length ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-6 gap-2 max-[1020px]:grid-cols-4 max-[640px]:grid-cols-3 max-[420px]:grid-cols-2">
                  {estadosBrasil.map((estado) => (
                    <label className="flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs font-bold text-slate-300" key={estado}>
                      <input checked={data.estados.includes(estado)} className="accent-sky-300" onChange={(event) => toggleEstado(estado, event.target.checked)} type="checkbox" />
                      {estado}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <h3 className="text-xs font-black text-slate-100">Exigir anexar arquivo para finalizar obrigação manual?</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 max-[720px]:grid-cols-1">
                {anexos.map((option) => (
                  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-3 text-xs text-slate-300" key={option}>
                    <input checked={data.exigirAnexo === option} className="accent-sky-300" onChange={() => updateField("exigirAnexo", option)} type="radio" />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </article>

          <div className="flex justify-end gap-2 max-[520px]:grid">
            <Link className="flex min-h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-200 transition hover:border-sky-300/40 hover:text-sky-100" href="/cadastros/obrigacoes">
              Cancelar
            </Link>
            <button className="min-h-10 rounded-lg bg-sky-300 px-5 text-xs font-black text-slate-950 shadow-[0_18px_42px_rgba(56,189,248,0.20)] disabled:opacity-60" disabled={isSaving || isLoadingObrigacao} type="submit">
              {isSaving ? "Salvando..." : isEdit ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </section>
      </form>
    </ErpChrome>
  );
}
