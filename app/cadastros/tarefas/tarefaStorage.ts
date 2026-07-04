"use client";

export type Tarefa = {
  id: string;
  titulo: string;
  tipo: "Único" | "Recorrente";
  recorrencia: "Diário" | "Semanal" | "Quinzenal" | "Mensal" | "Trimestral" | "Anual";
  dataInicio: string;
  cliente: string;
  clientes: string[];
  obrigacao: string;
  setor: string;
  responsavel: string;
  prazo: string;
  prioridade: "Baixa" | "Media" | "Alta" | "Critica";
  status: "Nova" | "Em andamento" | "Aguardando cliente" | "Concluida";
  evidenciaObrigatoria: string;
  subtarefas: string[];
  anexos: string[];
  finalizadaEm?: string;
  evidenciaFinalizacao?: string;
};

export const tarefasStorageKey = "tf-erp-tarefas";

export const initialTasks: Tarefa[] = [
  {
    id: "tarefa-demo-folha",
    titulo: "Conferir folha de pagamento",
    tipo: "Recorrente",
    recorrencia: "Mensal",
    dataInicio: "2026-06-01",
    cliente: "Empresa X",
    clientes: ["Empresa X"],
    obrigacao: "Folha mensal",
    setor: "Departamento Pessoal",
    responsavel: "Maria",
    prazo: "2026-07-25",
    prioridade: "Alta",
    status: "Em andamento",
    evidenciaObrigatoria: "Folha conferida em PDF",
    subtarefas: ["Conferir eventos", "Validar encargos", "Separar PDF da folha"],
    anexos: ["folha-conferida.pdf"],
  },
];

function normalizeTask(task: Partial<Tarefa>): Tarefa {
  const clientes = Array.isArray(task.clientes) && task.clientes.length > 0
    ? task.clientes
    : task.cliente
      ? [task.cliente]
      : [];
  const tipo = String(task.tipo || "") === "Manual" ? "Único" : task.tipo || "Único";

  return {
    id: task.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    titulo: task.titulo || "",
    tipo,
    recorrencia: task.recorrencia || "Mensal",
    dataInicio: task.dataInicio || task.prazo || "",
    cliente: clientes.join(", "),
    clientes,
    obrigacao: task.obrigacao || "Sem obrigação vinculada",
    setor: task.setor || "Fiscal",
    responsavel: task.responsavel || "",
    prazo: task.prazo || "",
    prioridade: task.prioridade || "Media",
    status: task.status || "Nova",
    evidenciaObrigatoria: task.evidenciaObrigatoria || "Não obrigatória",
    subtarefas: Array.isArray(task.subtarefas) ? task.subtarefas : [],
    anexos: Array.isArray(task.anexos) ? task.anexos : [],
    finalizadaEm: task.finalizadaEm,
    evidenciaFinalizacao: task.evidenciaFinalizacao,
  };
}

export function loadTasks() {
  if (typeof window === "undefined") return initialTasks;

  try {
    const stored = window.localStorage.getItem(tarefasStorageKey);
    const parsed = stored ? JSON.parse(stored) as Partial<Tarefa>[] : initialTasks;
    return parsed.map(normalizeTask);
  } catch {
    return initialTasks;
  }
}

export function saveTasks(tasks: Tarefa[]) {
  window.localStorage.setItem(tarefasStorageKey, JSON.stringify(tasks));
}
