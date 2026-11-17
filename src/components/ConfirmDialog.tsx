import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'warning' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = 'Konfirmasi & Simpan',
  cancelLabel = 'Batal',
  tone = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const confirmBtnClass =
    tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : tone === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-slate-900 hover:bg-slate-800 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            {tone === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            )}
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Tutup dialog konfirmasi"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">{description}</p>

          {details && details.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5">
              {details.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-medium text-slate-900 text-right tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60 ${confirmBtnClass}`}
          >
            {isLoading ? 'Menyimpan...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
