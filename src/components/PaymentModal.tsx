import React, { useEffect, useMemo, useState } from 'react';
import type { InvoiceRecord } from '../types/invoice';
import { formatRupiahWithPrefix } from '../utils/invoiceLogic';
import { ConfirmDialog } from './ConfirmDialog';
import { CheckSquare, X } from 'lucide-react';

interface PaymentModalProps {
  invoices: InvoiceRecord[];
  isSaving: boolean;
  onClose: () => void;
  onConfirmPayments: (
    invoices: InvoiceRecord[],
    payload: {
      paymentStatus: 'PAID' | 'UNPAID';
      paidDate: string;
      paymentRef: string;
      paymentNote: string;
    }
  ) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  invoices,
  isSaving,
  onClose,
  onConfirmPayments,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [paidDate, setPaidDate] = useState(todayIso);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const invoiceIdsKey = useMemo(() => invoices.map((i) => i.id).join(','), [invoices]);
  const totalGrandAmount = useMemo(
    () => invoices.reduce((sum, inv) => sum + inv.grandTotal, 0),
    [invoices]
  );

  useEffect(() => {
    if (invoices.length === 0) return;
    if (invoices.length === 1) {
      setPaidDate(invoices[0].paidDate || todayIso);
      setPaymentRef(invoices[0].paymentRef || '');
      setPaymentNote(invoices[0].paymentNote || '');
    } else {
      setPaidDate(todayIso);
      setPaymentRef('');
      setPaymentNote('');
    }
    setShowConfirm(false);
  }, [invoiceIdsKey, invoices, todayIso]);

  if (invoices.length === 0) return null;

  const isBulk = invoices.length > 1;
  const singleInvoice = invoices[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const previewNumbers =
    invoices.length <= 3
      ? invoices.map((i) => i.invoiceNumber).join(', ')
      : `${invoices
          .slice(0, 3)
          .map((i) => i.invoiceNumber)
          .join(', ')} (+${invoices.length - 3} lainnya)`;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2
                id="payment-modal-title"
                className="font-display text-base font-bold text-slate-900 flex items-center gap-2"
              >
                {isBulk && <CheckSquare className="h-4 w-4 text-emerald-600" />}
                <span>
                  {isBulk
                    ? `Verifikasi Pembayaran Massal (${invoices.length} Invoice)`
                    : 'Verifikasi Pembayaran Customer'}
                </span>
              </h2>
              <p className="font-mono text-xs text-slate-500 mt-0.5">
                {isBulk
                  ? `${invoices.length} invoice terpilih akan ditandai LUNAS sekaligus`
                  : singleInvoice.invoiceNumber}
              </p>
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

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {isBulk ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-slate-700">
                      Daftar Invoice Dipilih ({invoices.length})
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      Total: {formatRupiahWithPrefix(totalGrandAmount)}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-200/70">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs bg-white"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-slate-900 truncate">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {inv.billToName} · {inv.projectLocation} · {inv.terminLabel}
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                          {formatRupiahWithPrefix(inv.grandTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-medium text-slate-800 text-right truncate">
                      {singleInvoice.billToName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Proyek / Item</span>
                    <span className="font-semibold text-slate-900 text-right truncate">
                      {singleInvoice.projectLocation}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Termin</span>
                    <span className="font-medium text-slate-800">{singleInvoice.terminLabel}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="text-slate-600 font-medium">Nominal Tagihan</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiahWithPrefix(singleInvoice.grandTotal)}
                    </span>
                  </div>
                </div>
              )}

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
                  placeholder="Contoh: BCA-TRF/20261120/BATCH-01"
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
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                {isBulk ? `Verifikasi ${invoices.length} Invoice` : 'Verifikasi Lunas'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="success"
        title={
          isBulk
            ? `Konfirmasi Verifikasi ${invoices.length} Invoice Sekaligus`
            : 'Konfirmasi Verifikasi Pembayaran'
        }
        description={
          isBulk
            ? `Sebanyak ${invoices.length} invoice terpilih akan diperbarui statusnya menjadi PAID (Terbayar) secara bersamaan di Google Sheet dan mengurangi saldo piutang berjalan.`
            : 'Status pembayaran invoice ini akan diperbarui menjadi PAID (Terbayar) di Google Sheet dan mengurangi saldo piutang berjalan.'
        }
        details={[
          {
            label: isBulk ? 'Invoice Terpilih' : 'No. Invoice',
            value: previewNumbers,
          },
          {
            label: isBulk ? 'Total Nominal Diterima' : 'Nominal Diterima',
            value: formatRupiahWithPrefix(totalGrandAmount),
          },
          { label: 'Tanggal Bayar', value: paidDate },
          { label: 'Referensi', value: paymentRef },
        ]}
        confirmLabel={
          isBulk ? `Ya, Tandai ${invoices.length} Terbayar` : 'Ya, Tandai Terbayar'
        }
        isLoading={isSaving}
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => {
          setShowConfirm(false);
          await onConfirmPayments(invoices, {
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
