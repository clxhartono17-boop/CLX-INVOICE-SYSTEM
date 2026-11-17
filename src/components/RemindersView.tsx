import React, { useMemo, useState } from 'react';
import type { InvoiceRecord, QueryRow, ReminderUrgency } from '../types/invoice';
import { buildRetentionReminders } from '../utils/invoiceLogic';
import { AlertCircle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';

interface RemindersViewProps {
  queryRows: QueryRow[];
  invoices: InvoiceRecord[];
  referenceDateIso: string;
  onCreateTermin5Invoice: (row: QueryRow) => void;
  onCreateNextTerminInvoice: (row: QueryRow) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  queryRows,
  invoices,
  referenceDateIso,
  onCreateTermin5Invoice,
  onCreateNextTerminInvoice,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'URGENT' | 'SCHEDULED' | 'COMPLETED'>('ALL');

  const reminders = useMemo(
    () => buildRetentionReminders(queryRows, invoices, referenceDateIso),
    [queryRows, invoices, referenceDateIso]
  );

  const counts = useMemo(() => {
    return {
      urgent: reminders.filter((r) => r.urgency === 'OVERDUE' || r.urgency === 'DUE_SOON').length,
      scheduled: reminders.filter(
        (r) => r.urgency === 'UPCOMING' || r.urgency === 'SCHEDULED' || r.urgency === 'NO_DATE'
      ).length,
      completed: reminders.filter((r) => r.urgency === 'COMPLETED').length,
    };
  }, [reminders]);

  const filtered = useMemo(() => {
    return reminders.filter((r) => {
      if (filter === 'URGENT') return r.urgency === 'OVERDUE' || r.urgency === 'DUE_SOON';
      if (filter === 'SCHEDULED')
        return r.urgency === 'UPCOMING' || r.urgency === 'SCHEDULED' || r.urgency === 'NO_DATE';
      if (filter === 'COMPLETED') return r.urgency === 'COMPLETED';
      return true;
    });
  }, [reminders, filter]);

  const renderUrgencyLabel = (urgency: ReminderUrgency, days: number | null) => {
    if (urgency === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Termin 5% Selesai</span>
        </span>
      );
    }
    if (urgency === 'OVERDUE') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-red-700 tabular-nums">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Jatuh Tempo ({Math.abs(days || 0)} hari lewat)</span>
        </span>
      );
    }
    if (urgency === 'DUE_SOON') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 tabular-nums">
          <Clock className="h-3.5 w-3.5" />
          <span>Segera ({days} hari lagi)</span>
        </span>
      );
    }
    if (urgency === 'UPCOMING' || urgency === 'SCHEDULED') {
      return (
        <span className="inline-flex items-center gap-1 text-slate-600 tabular-nums">
          <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
          <span>{days} hari lagi</span>
        </span>
      );
    }
    return <span className="text-slate-400">Tanggal Kolom Y belum diisi</span>;
  };

  return (
    <div className="space-y-5">
      {/* Header Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Reminder Penagihan Termin 3 (5% Retensi 1 Tahun)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dihitung otomatis +1 tahun dari tanggal pada <span className="font-mono text-slate-700">Kolom Y</span> di sheet <span className="font-mono text-slate-700">Query</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({reminders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('URGENT')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'URGENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mendesak ({counts.urgent})
          </button>
          <button
            type="button"
            onClick={() => setFilter('SCHEDULED')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'SCHEDULED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terjadwal ({counts.scheduled})
          </button>
          <button
            type="button"
            onClick={() => setFilter('COMPLETED')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'COMPLETED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Selesai ({counts.completed})
          </button>
        </div>
      </div>

      {/* Reminder Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Tidak ada reminder retensi pada kategori ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Project / Location</th>
                  <th className="py-3 px-4">Charging Type &amp; WO</th>
                  <th className="py-3 px-4">Tanggal Kolom Y</th>
                  <th className="py-3 px-4">Jatuh Tempo +1 Tahun</th>
                  <th className="py-3 px-4">Prasyarat Termin</th>
                  <th className="py-3 px-4">Status Reminder</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((rem) => {
                  const rowObj = queryRows.find(
                    (q) =>
                      q.chargingType === rem.chargingType &&
                      q.projectLocation === rem.projectLocation
                  );
                  return (
                    <tr key={rem.projectKey} className="hover:bg-slate-50/75">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {rem.projectLocation}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700">{rem.chargingType}</div>
                        <div className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {rem.consWoNumber}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {rem.colYDateIso || rem.colYDateRaw || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {rem.dueDateIso || '-'}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                        <span className={rem.hasTermin35 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          35% {rem.hasTermin35 ? '✓' : '—'}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className={rem.hasTermin60 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          60% {rem.hasTermin60 ? '✓' : '—'}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className={rem.hasTermin5 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                          5% {rem.hasTermin5 ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderUrgencyLabel(rem.urgency, rem.daysRemaining)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {rem.hasTermin5 ? (
                          <span className="text-xs text-slate-400">Sudah Ditagih</span>
                        ) : rem.canCreateTermin5Directly && rowObj ? (
                          <button
                            type="button"
                            onClick={() => onCreateTermin5Invoice(rowObj)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                          >
                            Buat Invoice Termin 5%
                          </button>
                        ) : rowObj ? (
                          <button
                            type="button"
                            onClick={() => onCreateNextTerminInvoice(rowObj)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            Selesaikan Termin Awal
                          </button>
                        ) : null}
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
