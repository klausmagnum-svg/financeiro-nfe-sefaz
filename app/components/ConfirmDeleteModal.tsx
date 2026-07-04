"use client";

type ConfirmDeleteModalProps = {
  isOpen: boolean;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteModal({ isOpen, isDeleting = false, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/78 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#061020] p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rose-300/35 bg-rose-300/12 text-rose-200">
            <svg className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-100">Deseja mesmo fazer essa exclusao?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Essa acao remove o registro selecionado do ERP.</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="min-h-9 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-200 transition hover:border-sky-300/40 hover:text-sky-100"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="min-h-9 rounded-lg bg-rose-300 px-4 text-xs font-black text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? "Excluindo..." : "Sim"}
          </button>
        </div>
      </section>
    </div>
  );
}
