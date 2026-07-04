"use client";

import { FormEvent, useMemo, useState } from "react";
import ErpChrome from "@/app/components/ErpChrome";

const storageKey = "tf-erp-dados-empresa";

const initialForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  crc: "",
  responsavelTecnico: "",
  email: "",
  telefone: "",
  site: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  horarioAtendimento: "Segunda a sexta, das 08:00 às 18:00",
  missao: "",
  tomComunicacao: "Próximo, claro e profissional",
  lembretePadrao: "Enviar lembretes com antecedência e linguagem objetiva.",
  corPrincipal: "#38bdf8",
  assinaturaEmail: "",
};

type FormState = typeof initialForm;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-4 text-slate-500">{hint}</span>}
    </label>
  );
}

function inputClass() {
  return "min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 transition focus:border-sky-300/50";
}

function textareaClass() {
  return "min-h-24 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs leading-5 text-slate-100 outline-none placeholder:text-slate-600 transition focus:border-sky-300/50";
}

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value: string) {
  const digits = onlyDigits(value, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export default function DadosEmpresaPage() {
  const [form, setForm] = useState<FormState>(() => {
    if (typeof window === "undefined") return initialForm;

    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return initialForm;

    try {
      return { ...initialForm, ...JSON.parse(saved) };
    } catch {
      return initialForm;
    }
  });
  const [feedback, setFeedback] = useState("");

  const completion = useMemo(() => {
    const essentialFields: Array<keyof FormState> = ["razaoSocial", "nomeFantasia", "cnpj", "responsavelTecnico", "email", "telefone", "endereco", "cidade", "estado", "missao"];
    const filled = essentialFields.filter((field) => String(form[field]).trim()).length;
    return Math.round((filled / essentialFields.length) * 100);
  }, [form]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify(form));
    setFeedback("Dados da empresa salvos com sucesso.");
  }

  return (
    <ErpChrome>
      <header className="flex items-start justify-between gap-4 max-[760px]:flex-col">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">Configurações</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">Dados da empresa</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Centralize os dados do escritório para deixar o ERP com a identidade, os contatos e a rotina real da sua equipe.
          </p>
        </div>

        <div className="w-56 rounded-xl border border-white/10 bg-[#061020]/88 p-3 shadow-2xl shadow-black/20 max-[760px]:w-full">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Preenchimento</span>
            <strong className="text-lg font-black text-sky-300">{completion}%</strong>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div className="h-1.5 rounded-full bg-sky-300 transition-all" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-400">
            Quanto mais completo, mais consistentes ficam documentos, relatórios e comunicações.
          </p>
        </div>
      </header>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        {feedback && <p className="rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">{feedback}</p>}

        <section className="rounded-2xl border border-white/10 bg-[#061020]/88 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-4">
            <h2 className="text-base font-black text-slate-100">Identidade do escritório</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Estes dados ajudam o sistema a reconhecer o escritório como uma operação organizada, confiável e fácil de consultar.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
            <Field label="Razão social">
              <input className={inputClass()} onChange={(event) => updateField("razaoSocial", event.target.value)} placeholder="Ex.: XYZ Contabilidade Ltda" value={form.razaoSocial} />
            </Field>
            <Field label="Nome fantasia">
              <input className={inputClass()} onChange={(event) => updateField("nomeFantasia", event.target.value)} placeholder="Nome usado no dia a dia" value={form.nomeFantasia} />
            </Field>
            <Field label="CNPJ">
              <input className={inputClass()} inputMode="numeric" onChange={(event) => updateField("cnpj", formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" value={form.cnpj} />
            </Field>
            <Field label="CRC">
              <input className={inputClass()} onChange={(event) => updateField("crc", event.target.value)} placeholder="Registro do escritório ou responsável" value={form.crc} />
            </Field>
            <Field label="Responsável técnico">
              <input className={inputClass()} onChange={(event) => updateField("responsavelTecnico", event.target.value)} placeholder="Nome do contador responsável" value={form.responsavelTecnico} />
            </Field>
            <Field label="Cor principal" hint="Será útil para documentos e telas personalizadas.">
              <div className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3">
                <input className="h-6 w-9 cursor-pointer rounded border border-white/10 bg-transparent" onChange={(event) => updateField("corPrincipal", event.target.value)} type="color" value={form.corPrincipal} />
                <input className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none" onChange={(event) => updateField("corPrincipal", event.target.value)} value={form.corPrincipal} />
              </div>
            </Field>
          </div>
        </section>

        <section className="grid grid-cols-[1.2fr_0.8fr] gap-4 max-[980px]:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-[#061020]/88 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-4">
              <h2 className="text-base font-black text-slate-100">Contato e endereço</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Um cadastro completo evita retrabalho quando a equipe precisa confirmar dados ou montar comunicações.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <Field label="E-mail principal">
                <input className={inputClass()} onChange={(event) => updateField("email", event.target.value)} placeholder="contato@escritorio.com.br" type="email" value={form.email} />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input className={inputClass()} onChange={(event) => updateField("telefone", event.target.value)} placeholder="(00) 00000-0000" value={form.telefone} />
              </Field>
              <Field label="Site">
                <input className={inputClass()} onChange={(event) => updateField("site", event.target.value)} placeholder="https://..." value={form.site} />
              </Field>
              <Field label="CEP">
                <input className={inputClass()} inputMode="numeric" onChange={(event) => updateField("cep", formatCep(event.target.value))} placeholder="00.000-000" value={form.cep} />
              </Field>
              <Field label="Endereço">
                <input className={inputClass()} onChange={(event) => updateField("endereco", event.target.value)} placeholder="Rua, avenida..." value={form.endereco} />
              </Field>
              <Field label="Número">
                <input className={inputClass()} onChange={(event) => updateField("numero", event.target.value)} value={form.numero} />
              </Field>
              <Field label="Complemento">
                <input className={inputClass()} onChange={(event) => updateField("complemento", event.target.value)} value={form.complemento} />
              </Field>
              <Field label="Bairro">
                <input className={inputClass()} onChange={(event) => updateField("bairro", event.target.value)} value={form.bairro} />
              </Field>
              <Field label="Cidade">
                <input className={inputClass()} onChange={(event) => updateField("cidade", event.target.value)} value={form.cidade} />
              </Field>
              <Field label="UF">
                <input className={inputClass()} maxLength={2} onChange={(event) => updateField("estado", event.target.value.toUpperCase())} value={form.estado} />
              </Field>
            </div>
          </div>

          <aside className="rounded-2xl border border-sky-300/20 bg-slate-950/60 p-5 shadow-2xl shadow-black/20">
            <h2 className="text-base font-black text-slate-100">Resumo do escritório</h2>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Nome público</p>
              <strong className="mt-2 block text-lg font-black text-sky-100">{form.nomeFantasia || "Seu escritório"}</strong>
              <p className="mt-2 text-xs leading-5 text-slate-400">{form.razaoSocial || "Preencha a razão social para compor documentos e relatórios."}</p>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-slate-400">
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">Responsável: {form.responsavelTecnico || "Não informado"}</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">Contato: {form.email || form.telefone || "Não informado"}</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">Cidade: {form.cidade || "Não informada"} {form.estado && `- ${form.estado}`}</span>
            </div>
          </aside>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#061020]/88 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-4">
            <h2 className="text-base font-black text-slate-100">Rotina e comunicação</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Campos pensados para deixar o uso do ERP mais humano: clareza para a equipe e tranquilidade para quem consulta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
            <Field label="Horário de atendimento">
              <input className={inputClass()} onChange={(event) => updateField("horarioAtendimento", event.target.value)} value={form.horarioAtendimento} />
            </Field>
            <Field label="Tom de comunicação">
              <input className={inputClass()} onChange={(event) => updateField("tomComunicacao", event.target.value)} value={form.tomComunicacao} />
            </Field>
            <Field label="Missão do escritório" hint="Uma frase curta que ajude a equipe a lembrar o cuidado por trás da rotina.">
              <textarea className={textareaClass()} onChange={(event) => updateField("missao", event.target.value)} placeholder="Ex.: Entregar tranquilidade contábil com organização, clareza e proximidade." value={form.missao} />
            </Field>
            <Field label="Lembrete padrão">
              <textarea className={textareaClass()} onChange={(event) => updateField("lembretePadrao", event.target.value)} value={form.lembretePadrao} />
            </Field>
            <Field label="Assinatura de e-mail">
              <textarea className={textareaClass()} onChange={(event) => updateField("assinaturaEmail", event.target.value)} placeholder="Nome, cargo, telefone e mensagem padrão." value={form.assinaturaEmail} />
            </Field>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Boa prática</p>
              <p className="mt-3 text-sm font-bold text-slate-100">Dados bem preenchidos reduzem ruído.</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Quando a informação institucional fica centralizada, a equipe consulta menos planilhas soltas e trabalha com mais segurança.
              </p>
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-xl border border-white/10 bg-[#061020]/90 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl max-[560px]:grid">
          <button className="min-h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-100" onClick={() => setForm(initialForm)} type="button">
            Limpar
          </button>
          <button className="min-h-10 rounded-lg bg-sky-300 px-5 text-xs font-black text-slate-950 shadow-[0_18px_42px_rgba(56,189,248,0.20)]" type="submit">
            Salvar dados da empresa
          </button>
        </div>
      </form>
    </ErpChrome>
  );
}
