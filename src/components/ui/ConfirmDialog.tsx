import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}

// The app's own confirmation box (same look as the delete dialogs), used instead of window.confirm
export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  // One confirm per opening: a double click on "Delete" must not delete twice
  const fired = useRef(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (open) {
      fired.current = false;
      setWorking(false);
    }
  }, [open]);

  const confirm = async () => {
    if (fired.current) return;
    fired.current = true;
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="card w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto">
            <X className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 id="confirm-title" className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>}
          </div>
          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onCancel} className="flex-1 px-6 py-3 btn-secondary text-sm font-bold">
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => void confirm()}
              disabled={working}
              aria-busy={working}
              className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70"
            >
              {working ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
