import React, { useMemo, useState } from 'react';
import type { InvoiceRecord } from '../types/invoice';
import { formatRupiahWithPrefix } from '../utils/invoiceLogic';
import { CheckCircle2, Edit3, FileDown, Eye, Plus, Search, History } from 'lucide-react';

interface InvoiceListViewProps {
  invoices: InvoiceRecord[];
  onCreateNew: (mode: 'NEW' | 'LEGACY') => void;
  onEditInvoice: (invoice: InvoiceRecord) => void;
  onOpenPdf: (invoice: InvoiceRecord) => void;
  onDownloadPdf: (invoice: InvoiceRecord) => void;
  onOpenVerifyPayment: (invoice: InvoiceRecord) => void;
}

export const InvoiceListView: React.FC<InvoiceListViewProps> = ({
  invoices,
  onCreateNew,
  onEditInvoice,
  onOpenPdf,
  onDownloadPdf,
  onOpenVerifyPayment,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [terminFilter, setTerminFilter] = useState<'ALL' | '35' | '60' | '5'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'NEW' | 'LEGACY'>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...invoices]
      .sort((a, b) => b.seqNumber - a.seqNumber || b.invoiceDate.localeCompare(a.invoiceDate))
      .filter((inv) => {
        if (statusFilter !== 'ALL' && inv.paymentStatus !== statusFilter) return false;
        if (terminFilter !== 'ALL' && String(inv.termin) !== terminFilter) return false;
        if (modeFilter !== 'ALL' && inv.mode !== modeFilter) return false;
        if (!q) return true;
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.projectLocation.toLowerCase().includes(q) ||
          inv.chargingType.toLowerCase().includes(q) ||
          inv.consWoNumber.toLowerCase().includes(q) ||
          inv.noEfaktur.toLowerCase().includes(q)
        );
      });
  }, [invoices, search, statusFilter, terminFilter, modeFilter]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-56 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari invoice, lokasi, WO..."
              aria-label="Cari daftar invoice"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'UNPAID', 'PAID'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st === 'PAID' ? 'Lunas' : 'Belum Bayar'}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter berdasarkan termin"
            value={terminFilter}
            onChange={(e) => setTerminFilter(e.target.value as 'ALL' | '35' | '60' | '5')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Semua Termin</option>
            <option value="35">Termin 1 (35%)</option>
            <option value="60">Termin 2 (60%)</option>
            <option value="5">Termin 3 (5%)</option>
          </select>

          <select
            aria-label="Filter berdasarkan mode invoice"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as 'ALL' | 'NEW' | 'LEGACY')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Baru &amp; Lama</option>
            <option value="NEW">Invoice Baru</option>
            <option value="LEGACY">Invoice Lama</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onCreateNew('LEGACY')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <History className="h-3.5 w-3.5" />
            <span>Input Invoice Lama</span>
          </button>
          <button
            type="button"
            onClick={() => onCreateNew('NEW')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Buat Invoice Baru</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-3">
            <div className="text-sm font-medium text-slate-900">
              Tidak ada invoice yang cocok dengan filter Anda
            </div>
            <p className="text-xs text-slate-500">
              Coba ubah kata kunci pencarian atau buat invoice baru dari data sheet Query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-3">No. Invoice &amp; Tanggal</th>
                  <th className="py-2.5 px-3">Project, Charging &amp; WO</th>
                  <th className="py-2.5 px-3">Termin</th>
                  <th className="py-2.5 px-3 text-right">Grand Total (PPN)</th>
                  <th className="py-2.5 px-3">Pembayaran</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-3 max-w-[210px] tabular-nums">
                      <div className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {inv.invoiceDateDisplay || inv.invoiceDate} ·{' '}
                        {inv.mode === 'LEGACY' ? 'Legacy' : 'Auto'}
                        {inv.noEfaktur ? ` · ${inv.noEfaktur}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-[195px]">
                      <div className="font-semibold text-slate-900 truncate">
                        {inv.projectLocation}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {inv.chargingType} · <span className="font-mono">{inv.consWoNumber}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800 tabular-nums">
                      {inv.terminLabel}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                      <div className="font-semibold text-slate-900">
                        {formatRupiahWithPrefix(inv.grandTotal)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        DPP: {formatRupiahWithPrefix(inv.terminAmount)}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-[175px]">
                      {inv.paymentStatus === 'PAID' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 whitespace-nowrap">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Terbayar</span>
                          </span>
                          <div className="text-[11px] text-slate-500 tabular-nums truncate">
                            {inv.paidDate} {inv.paymentRef ? `· ${inv.paymentRef}` : ''}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenVerifyPayment(inv)}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-4 whitespace-nowrap"
                        >
                          Belum Bayar · Verifikasi
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenPdf(inv)}
                          aria-label={`Preview PDF ${inv.invoiceNumber}`}
                          title="Preview A4"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownloadPdf(inv)}
                          aria-label={`Download PDF ${inv.invoiceNumber}`}
                          title="Download PDF A4"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditInvoice(inv)}
                          aria-label={`Edit invoice ${inv.invoiceNumber}`}
                          title="Edit Invoice"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
