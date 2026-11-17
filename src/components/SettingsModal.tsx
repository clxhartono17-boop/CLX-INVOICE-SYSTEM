import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../types/invoice';
import { extractSpreadsheetId } from '../utils/invoiceLogic';
import { X } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (next: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);

  useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      spreadsheetId: extractSpreadsheetId(form.spreadsheetId),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="my-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="settings-modal-title" className="font-display text-base font-bold text-slate-900">
            Pengaturan Sistem &amp; Google Sheets
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="set-sheet-id" className="block font-semibold text-slate-700">
              URL atau ID Google Spreadsheet
            </label>
            <input
              id="set-sheet-id"
              type="text"
              required
              value={form.spreadsheetId}
              onChange={(e) => setForm({ ...form, spreadsheetId: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="set-query-tab" className="block font-semibold text-slate-700">
                Nama Tab Sumber Data
              </label>
              <input
                id="set-query-tab"
                type="text"
                required
                value={form.querySheetName}
                onChange={(e) => setForm({ ...form, querySheetName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="set-invoices-tab" className="block font-semibold text-slate-700">
                Nama Tab Database Invoice Baru
              </label>
              <input
                id="set-invoices-tab"
                type="text"
                required
                value={form.invoicesSheetName}
                onChange={(e) => setForm({ ...form, invoicesSheetName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="set-start-seq" className="block font-semibold text-slate-700">
                Nomor Urut Awal Auto-Invoice
              </label>
              <input
                id="set-start-seq"
                type="number"
                min={1}
                required
                value={form.startingSequence}
                onChange={(e) => setForm({ ...form, startingSequence: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="set-tax-rate" className="block font-semibold text-slate-700">
                Default Tax / PPN (%)
              </label>
              <input
                id="set-tax-rate"
                type="number"
                min={0}
                max={30}
                step={0.5}
                required
                value={form.defaultTaxRate}
                onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="set-bill-name" className="block font-semibold text-slate-700">
              Default Bill To
            </label>
            <input
              id="set-bill-name"
              type="text"
              value={form.defaultBillToName}
              onChange={(e) => setForm({ ...form, defaultBillToName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="set-sig-name" className="block font-semibold text-slate-700">
                Penandatangan
              </label>
              <input
                id="set-sig-name"
                type="text"
                value={form.signatoryName}
                onChange={(e) => setForm({ ...form, signatoryName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-sig-title" className="block font-semibold text-slate-700">
                Jabatan
              </label>
              <input
                id="set-sig-title"
                type="text"
                value={form.signatoryTitle}
                onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-sig-city" className="block font-semibold text-slate-700">
                Kota
              </label>
              <input
                id="set-sig-city"
                type="text"
                value={form.signatoryCity}
                onChange={(e) => setForm({ ...form, signatoryCity: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
