import React, { useEffect, useState } from 'react';
import type { InvoiceRecord } from '../types/invoice';
import { formatRupiahWithPrefix } from '../utils/invoiceLogic';
import { ConfirmDialog } from './ConfirmDialog';
import { X } from 'lucide-react';

interface PaymentModalProps {
  invoice: InvoiceRecord | null;
  isSaving: boolean;
  onClose: () => void;
  onConfirmPayment: (
    invoice: InvoiceRecord,
    payload: {
      paymentStatus: 'PAID' | 'UNPAID';
      paidDate: string;
      paymentRef: string;
      paymentNote: string;
    }
  ) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  invoice,
  isSaving,
  onClose,
  onConfirmPayment,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [paidDate, setPaidDate] = useState(todayIso);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setPaidDate(invoice.paidDate || todayIso);
    setPaymentRef(invoice.paymentRef || '');
    setPaymentNote(invoice.paymentNote || '');
    setShowConfirm(false);
  }, [invoice, todayIso]);

  if (!invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 id="payment-modal-title" className="font-display text-base font-bold text-slate-900">
                Verifikasi Pembayaran Customer
              </h2>
              <p className="font-mono text-xs text-slate-500 mt-0.5">{invoice.invoiceNumber}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal verifikasi pembayaran"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Proyek</span>
                <span className="font-semibold text-slate-900">{invoice.projectLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Termin</span>
                <span className="font-medium text-slate-800">{invoice.terminLabel}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                <span className="text-slate-600 font-medium">Nominal Tagihan</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatRupiahWithPrefix(invoice.grandTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="paid-date-input" className="block text-xs font-semibold text-slate-700">
                Tanggal Dana Masuk (BCA)
              </label>
              <input
                id="paid-date-input"
                type="date"
                required
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payment-ref-input" className="block text-xs font-semibold text-slate-700">
                No. Referensi Transfer / Bukti Bayar
              </label>
              <input
                id="payment-ref-input"
                type="text"
                required
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="Contoh: BCA-TRF/20261117/001"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payment-note-input" className="block text-xs font-semibold text-slate-700">
                Catatan Verifikasi (Opsional)
              </label>
              <input
                id="payment-note-input"
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Diterima di rekening BCA 540-5282841"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Verifikasi Lunas
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="success"
        title="Konfirmasi Verifikasi Pembayaran"
        description="Status pembayaran invoice ini akan diperbarui menjadi PAID (Terbayar) di Google Sheet dan mengurangi saldo piutang berjalan."
        details={[
          { label: 'No. Invoice', value: invoice.invoiceNumber },
          { label: 'Nominal Diterima', value: formatRupiahWithPrefix(invoice.grandTotal) },
          { label: 'Tanggal Bayar', value: paidDate },
          { label: 'Referensi', value: paymentRef },
        ]}
        confirmLabel="Ya, Tandai Terbayar"
        isLoading={isSaving}
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => {
          setShowConfirm(false);
          await onConfirmPayment(invoice, {
            paymentStatus: 'PAID',
            paidDate,
            paymentRef: paymentRef.trim(),
            paymentNote: paymentNote.trim(),
          });
        }}
      />
    </>
  );
};
