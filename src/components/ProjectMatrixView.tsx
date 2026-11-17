import React, { useMemo, useState } from 'react';
import type { InvoiceRecord, QueryRow, TerminPercent } from '../types/invoice';
import { buildProjectTerminSummaries, formatRupiahWithPrefix } from '../utils/invoiceLogic';
import { CheckCircle2, Lock, Plus, Search } from 'lucide-react';

interface ProjectMatrixViewProps {
  queryRows: QueryRow[];
  invoices: InvoiceRecord[];
  onCreateInvoiceForProject: (
    row: QueryRow,
    suggestedTermin?: TerminPercent,
    mode?: 'NEW' | 'LEGACY'
  ) => void;
  onOpenPdf: (invoice: InvoiceRecord) => void;
}

export const ProjectMatrixView: React.FC<ProjectMatrixViewProps> = ({
  queryRows,
  invoices,
  onCreateInvoiceForProject,
  onOpenPdf,
}) => {
  const [search, setSearch] = useState('');
  const [chargingTypeFilter, setChargingTypeFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('ALL');

  const summaries = useMemo(
    () => buildProjectTerminSummaries(queryRows, invoices),
    [queryRows, invoices]
  );

  const chargingTypes = useMemo(() => {
    const set = new Set(queryRows.map((r) => r.chargingType).filter(Boolean));
    return Array.from(set).sort();
  }, [queryRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter((s) => {
      if (chargingTypeFilter !== 'ALL' && s.chargingType !== chargingTypeFilter) return false;
      if (stageFilter === 'OPEN' && s.completionPercent === 100) return false;
      if (stageFilter === 'COMPLETED' && s.completionPercent !== 100) return false;
      if (!q) return true;
      return (
        s.projectLocation.toLowerCase().includes(q) ||
        s.chargingType.toLowerCase().includes(q) ||
        s.consWoNumber.toLowerCase().includes(q)
      );
    });
  }, [summaries, search, chargingTypeFilter, stageFilter]);

  const renderTerminCell = (inv: InvoiceRecord | null, pct: TerminPercent) => {
    if (!inv) {
      return <span className="text-slate-400">Belum ditagih ({pct}%)</span>;
    }
    return (
      <button
        type="button"
        onClick={() => onOpenPdf(inv)}
        className="text-left group"
        title={`Lihat PDF ${inv.invoiceNumber}`}
      >
        <div className="flex items-center gap-1 font-mono font-semibold text-slate-900 group-hover:underline">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>{inv.invoiceNumber}</span>
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">
          {formatRupiahWithPrefix(inv.grandTotal)} ·{' '}
          <span className={inv.paymentStatus === 'PAID' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            {inv.paymentStatus === 'PAID' ? 'Lunas' : 'Unpaid'}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari lokasi, charging type, atau WO No..."
              aria-label="Cari proyek CLX"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter Charging Type"
            value={chargingTypeFilter}
            onChange={(e) => setChargingTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">Semua Charging Type</option>
            {chargingTypes.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'OPEN', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStageFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  stageFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'Semua Proyek' : st === 'OPEN' ? 'Belum 100%' : 'Selesai 100%'}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {filtered.length} dari {summaries.length} proyek CLX (WO terisi)
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            Tidak ada proyek CLX dengan Cons WO Number yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Project / Location (Col F) &amp; Charging Type (Col C)</th>
                  <th className="py-3 px-4">Cons WO No. (Col W)</th>
                  <th className="py-3 px-4">Termin 1 (35%)</th>
                  <th className="py-3 px-4">Termin 2 (60%)</th>
                  <th className="py-3 px-4">Termin 3 (5%)</th>
                  <th className="py-3 px-4 text-right">Penagihan Berikutnya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((proj) => {
                  const rowObj = queryRows.find(
                    (r) =>
                      r.chargingType === proj.chargingType &&
                      r.projectLocation === proj.projectLocation
                  );
                  return (
                    <tr key={proj.projectKey} className="hover:bg-slate-50/75">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{proj.projectLocation}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {proj.chargingType}
                          {proj.colYDateIso ? ` · Tgl Col Y: ${proj.colYDateIso}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {proj.consWoNumber}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderTerminCell(proj.termin35, 35)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderTerminCell(proj.termin60, 60)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderTerminCell(proj.termin5, 5)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {proj.nextAllowedTermin && rowObj ? (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateInvoiceForProject(rowObj, proj.nextAllowedTermin!, 'NEW')
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Tagih Termin {proj.nextAllowedTermin}%</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <Lock className="h-3.5 w-3.5" />
                            <span>100% Tertagih</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
