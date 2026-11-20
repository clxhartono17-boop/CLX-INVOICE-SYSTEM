import React, { useEffect, useMemo, useState } from 'react';
import type {
  ActiveTab,
  CustomerRecord,
  InvoiceRecord,
  ProjectTerminSummary,
  QueryRow,
  RetentionReminder,
} from '../types/invoice';
import {
  buildDashboardMetrics,
  buildProjectTerminSummaries,
  buildRetentionReminders,
  formatDateDdMmmYyyy,
  formatRupiahWithPrefix,
} from '../utils/invoiceLogic';
import { filterDashboardByCustomer } from '../utils/bulkInvoiceLogic';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Plus,
} from 'lucide-react';

interface DashboardViewProps {
  queryRows: QueryRow[];
  invoices: InvoiceRecord[];
  customers: CustomerRecord[];
  selectedCustomer: string;
  onSelectCustomer: (customerName: string) => void;
  referenceDateIso: string;
  onNavigateTab: (tab: ActiveTab) => void;
  onCreateInvoiceForProject: (row: QueryRow, suggestedTermin?: 35 | 60 | 5) => void;
  onCreateNewInvoice: (mode: 'NEW' | 'LEGACY') => void;
  onOpenBulkCreate: (mode: 'NEW' | 'LEGACY') => void;
  onOpenPdf: (invoice: InvoiceRecord) => void;
  onOpenVerifyPayment: (invoice: InvoiceRecord) => void;
  onOpenBulkVerifyPayment: (invoices: InvoiceRecord[]) => void;
}

function formatCompactIdr(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}rb`;
  return String(val);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  queryRows,
  invoices,
  customers,
  selectedCustomer,
  onSelectCustomer,
  referenceDateIso,
  onNavigateTab,
  onCreateInvoiceForProject,
  onCreateNewInvoice,
  onOpenBulkCreate,
  onOpenPdf,
  onOpenVerifyPayment,
  onOpenBulkVerifyPayment,
}) => {
  const [selectedUnpaidIds, setSelectedUnpaidIds] = useState<Set<string>>(new Set());

  const { filteredInvoices, filteredQueryRows, isAllSelected, isVgreenSelected } = useMemo(
    () => filterDashboardByCustomer(invoices, queryRows, selectedCustomer),
    [invoices, queryRows, selectedCustomer]
  );

  const metrics = useMemo(
    () => buildDashboardMetrics(filteredQueryRows, filteredInvoices, referenceDateIso),
    [filteredQueryRows, filteredInvoices, referenceDateIso]
  );

  const reminders: RetentionReminder[] = useMemo(
    () =>
      buildRetentionReminders(filteredQueryRows, filteredInvoices, referenceDateIso).filter(
        (r) => r.urgency !== 'COMPLETED'
      ),
    [filteredQueryRows, filteredInvoices, referenceDateIso]
  );

  const projectSummaries: ProjectTerminSummary[] = useMemo(
    () => buildProjectTerminSummaries(filteredQueryRows, filteredInvoices),
    [filteredQueryRows, filteredInvoices]
  );

  const unpaidInvoices = useMemo(
    () =>
      filteredInvoices
        .filter((i) => i.paymentStatus === 'UNPAID')
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
    [filteredInvoices]
  );

  useEffect(() => {
    const unpaidIdSet = new Set(unpaidInvoices.map((i) => i.id));
    setSelectedUnpaidIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (unpaidIdSet.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [unpaidInvoices]);

  const checkedUnpaidInvoices = useMemo(
    () => unpaidInvoices.filter((inv) => selectedUnpaidIds.has(inv.id)),
    [unpaidInvoices, selectedUnpaidIds]
  );

  const maxMonthlyVal = Math.max(
    1,
    ...metrics.monthlyTrend.map((m) => Math.max(m.invoiced, m.collected))
  );

  const totalTerminSum = Math.max(
    1,
    metrics.terminBreakdown.termin35Amount +
      metrics.terminBreakdown.termin60Amount +
      metrics.terminBreakdown.termin5Amount
  );

  const pct35 = Math.round((metrics.terminBreakdown.termin35Amount / totalTerminSum) * 100);
  const pct60 = Math.round((metrics.terminBreakdown.termin60Amount / totalTerminSum) * 100);
  const pct5 = Math.max(0, 100 - pct35 - pct60);

  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const len35 = (pct35 / 100) * circ;
  const len60 = (pct60 / 100) * circ;
  const len5 = (pct5 / 100) * circ;

  const toggleUnpaidCheck = (id: string) => {
    setSelectedUnpaidIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Customer Scope Selector Bar */}
      <section
        aria-label="Filter Customer Dashboard"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-5 py-3.5"
      >
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 whitespace-nowrap">
            <Building2 className="h-4 w-4 text-[#0A192F]" />
            <label htmlFor="dashboard-customer-select">Customer Scope:</label>
          </div>
          <select
            id="dashboard-customer-select"
            value={selectedCustomer}
            onChange={(e) => onSelectCustomer(e.target.value)}
            className="min-w-[240px] max-w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#0A192F] focus:bg-white focus:outline-none"
          >
            <option value="ALL">Semua Customer ({customers.length} Terdaftar)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span>
            Menampilkan <strong>{metrics.invoiceCount} invoice</strong>
            {!isAllSelected ? ` untuk customer terpilih` : ' gabungan seluruh customer'}
          </span>
          {!isAllSelected && (
            <button
              type="button"
              onClick={() => onSelectCustomer('ALL')}
              className="font-semibold text-[#0A192F] hover:underline underline-offset-4 whitespace-nowrap"
            >
              Reset Semua
            </button>
          )}
        </div>
      </section>

      {/* Executive Hero Row: Deep Navy Anchor Card + 3 Structural KPI Cards */}
      <section
        aria-label="Ringkasan Keuangan Utama"
        className="grid grid-cols-1 xl:grid-cols-12 gap-4"
      >
        {/* Dominant Focal Anchor Card */}
        <div className="xl:col-span-5 rounded-xl bg-[#0A192F] text-white p-6 flex flex-col justify-between relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/[0.04]"
          />
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 truncate">
                {isAllSelected
                  ? 'Total Nilai Tertagih (Semua Customer)'
                  : `Total Tertagih · ${selectedCustomer}`}
              </span>
              <span className="text-xs font-mono text-emerald-400 tabular-nums shrink-0">
                {metrics.collectionRate}% Collected
              </span>
            </div>
            <div className="mt-2 font-display text-3xl font-bold tracking-tight text-white tabular-nums">
              {formatRupiahWithPrefix(metrics.totalInvoiced)}
            </div>

            {/* Collection Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  style={{ width: `${metrics.collectionRate}%` }}
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                <span>{metrics.invoiceCount} invoice diterbitkan</span>
                <span>PPN Termasuk</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCreateNewInvoice('NEW')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0A192F] hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Invoice Baru</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenBulkCreate('NEW')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Bulk Excel/Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => onCreateNewInvoice('LEGACY')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <span>Invoice Lama</span>
            </button>
          </div>
        </div>

        {/* 3 Secondary Metric Cards */}
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Dana Terbayar (Collected)</div>
              <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
                {formatRupiahWithPrefix(metrics.totalCollected)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {metrics.paidCount} invoice terverifikasi lunas
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
            >
              <span>Lihat Ledger</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Piutang Berjalan</div>
              <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-700 tabular-nums">
                {formatRupiahWithPrefix(metrics.totalOutstanding)}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {metrics.unpaidCount} invoice menunggu pembayaran
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
            >
              <span>Verifikasi Bayar</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {isVgreenSelected ? (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">Reminder Termin 5%</div>
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {metrics.urgentRemindersCount} Proyek
                </div>
                <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
                  {metrics.eligibleProjectsCount} proyek CLX · {metrics.fullyCompletedProjects}{' '}
                  selesai
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('reminders')}
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
              >
                <span>Buka Reminder 1 Thn</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">Volume Invoice Customer</div>
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {metrics.invoiceCount} Invoice
                </div>
                <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
                  {metrics.paidCount} lunas · {metrics.unpaidCount} belum bayar
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCreateNewInvoice('NEW')}
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
              >
                <span>Buat Invoice Baru</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Visual Analytics Row: Monthly Cashflow Chart + SVG Donut Termin Composition */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200/90 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Tren Penagihan &amp; Pelunasan Bulanan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan nilai invoice diterbitkan vs dana terverifikasi masuk
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0A192F]" />
                Invoiced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                Paid
              </span>
            </div>
          </div>

          {metrics.monthlyTrend.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Belum ada data penagihan untuk customer terpilih pada grafik.
            </div>
          ) : (
            <div className="mt-6">
              <div className="relative grid grid-cols-6 gap-3 items-end h-52 border-b border-slate-200 pb-2 pt-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between"
                >
                  <div className="border-t border-dashed border-slate-200/80 w-full" />
                  <div className="border-t border-dashed border-slate-200/80 w-full" />
                  <div className="border-t border-dashed border-slate-200/80 w-full" />
                </div>

                {metrics.monthlyTrend.map((m) => {
                  const invH = Math.max(8, Math.round((m.invoiced / maxMonthlyVal) * 144));
                  const colH =
                    m.collected > 0
                      ? Math.max(8, Math.round((m.collected / maxMonthlyVal) * 144))
                      : 0;
                  return (
                    <div
                      key={m.monthKey}
                      className="relative z-10 flex flex-col items-center justify-end h-full gap-1.5 group"
                    >
                      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                        {formatCompactIdr(m.invoiced)}
                      </span>
                      <div className="flex items-end gap-1.5 h-36">
                        <div
                          title={`Invoiced: ${formatRupiahWithPrefix(m.invoiced)}`}
                          style={{ height: `${invH}px` }}
                          className="w-5 sm:w-6 rounded-t bg-[#0A192F] group-hover:bg-[#173058] transition-colors"
                        />
                        <div
                          title={`Paid: ${formatRupiahWithPrefix(m.collected)}`}
                          style={{ height: `${colH}px` }}
                          className="w-5 sm:w-6 rounded-t bg-emerald-600 group-hover:bg-emerald-500 transition-colors"
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                <span>Periode 6 bulan terakhir</span>
                <span>Puncak bulanan: {formatRupiahWithPrefix(maxMonthlyVal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Termin Donut & Composition */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-white p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Komposisi Penagihan per Termin
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Porsi nilai penagihan Termin 1 (35%), Termin 2 (60%), dan Retensi (5%)
            </p>

            <div className="mt-5 flex items-center gap-6">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="12"
                  />
                  {metrics.totalInvoiced > 0 && (
                    <>
                      <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke="#0A192F"
                        strokeWidth="12"
                        strokeDasharray={`${len35} ${circ}`}
                        strokeDashoffset={0}
                      />
                      <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke="#5C7698"
                        strokeWidth="12"
                        strokeDasharray={`${len60} ${circ}`}
                        strokeDashoffset={-len35}
                      />
                      <circle
                        cx="55"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke="#16A34A"
                        strokeWidth="12"
                        strokeDasharray={`${len5} ${circ}`}
                        strokeDashoffset={-(len35 + len60)}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {metrics.invoiceCount}
                  </span>
                  <span className="text-[10px] text-slate-500">Invoice</span>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#0A192F]" />
                    Termin 1 (35%)
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {pct35}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#5C7698]" />
                    Termin 2 (60%)
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {pct60}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                    Retensi (5%)
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {pct5}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">
                  Termin 1 · {metrics.terminBreakdown.termin35Count} invoice
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatRupiahWithPrefix(metrics.terminBreakdown.termin35Amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">
                  Termin 2 · {metrics.terminBreakdown.termin60Count} invoice
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatRupiahWithPrefix(metrics.terminBreakdown.termin60Amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">
                  Retensi 5% · {metrics.terminBreakdown.termin5Count} invoice
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatRupiahWithPrefix(metrics.terminBreakdown.termin5Amount)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(isVgreenSelected ? 'projects' : 'invoices')}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <span>
              {isVgreenSelected ? 'Lihat Matriks Termin Semua Proyek' : 'Lihat Daftar Invoice'}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Actionable Queues */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isVgreenSelected && (
          <div className="lg:col-span-6 rounded-xl border border-slate-200/90 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Jadwal Reminder Termin 5% (Kolom Y + 1 Tahun)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proyek Vgreen mendekati atau melewati jatuh tempo retensi 1 tahun
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('reminders')}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
              >
                Semua Reminder
              </button>
            </div>

            {reminders.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Seluruh proyek CLX telah menyelesaikan penagihan Termin 5%.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reminders.slice(0, 4).map((rem) => {
                  const matchingQuery = filteredQueryRows.find(
                    (q) =>
                      q.chargingType === rem.chargingType &&
                      q.projectLocation === rem.projectLocation
                  );
                  const statusLabel =
                    rem.urgency === 'OVERDUE'
                      ? `Lewat ${Math.abs(rem.daysRemaining || 0)} hari`
                      : rem.urgency === 'DUE_SOON'
                        ? `${rem.daysRemaining} hari lagi`
                        : rem.dueDateIso
                          ? `${rem.daysRemaining} hari lagi`
                          : 'Tanggal Kolom Y kosong';
                  const statusColor =
                    rem.urgency === 'OVERDUE'
                      ? 'text-red-700 font-semibold'
                      : rem.urgency === 'DUE_SOON'
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-600';

                  return (
                    <div
                      key={rem.projectKey}
                      className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {rem.projectLocation}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                          <span>{rem.chargingType}</span>
                          <span aria-hidden="true">·</span>
                          <span>Due: {rem.dueDateIso || '-'}</span>
                          <span aria-hidden="true">·</span>
                          <span className={statusColor}>{statusLabel}</span>
                        </div>
                      </div>
                      {matchingQuery && (
                        <button
                          type="button"
                          onClick={() =>
                            onCreateInvoiceForProject(
                              matchingQuery,
                              rem.canCreateTermin5Directly ? 5 : undefined
                            )
                          }
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-[#0A192F] hover:text-white hover:border-[#0A192F] transition-colors whitespace-nowrap"
                        >
                          {rem.canCreateTermin5Directly ? 'Tagih 5%' : 'Buat Termin'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div
          className={`${
            isVgreenSelected ? 'lg:col-span-6' : 'lg:col-span-12'
          } rounded-xl border border-slate-200/90 bg-white overflow-hidden`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Invoice Menunggu Verifikasi Pembayaran
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Centang satu atau beberapa invoice untuk verifikasi pelunasan sekaligus
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {checkedUnpaidInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenBulkVerifyPayment(checkedUnpaidInvoices)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                >
                  Verifikasi Terpilih ({checkedUnpaidInvoices.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('invoices')}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
              >
                Semua Invoice
              </button>
            </div>
          </div>

          {unpaidInvoices.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <span>Semua invoice untuk filter ini sudah terverifikasi lunas.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {unpaidInvoices.slice(0, 6).map((inv) => {
                const isChecked = selectedUnpaidIds.has(inv.id);
                return (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between gap-4 px-6 py-3.5 transition-colors ${
                      isChecked ? 'bg-emerald-50/45' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Pilih verifikasi ${inv.invoiceNumber}`}
                        checked={isChecked}
                        onChange={() => toggleUnpaidCheck(inv.id)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#0A192F] focus:ring-[#0A192F] cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="font-mono text-xs whitespace-nowrap">
                            {inv.invoiceNumber}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="truncate">{inv.projectLocation}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                          {isAllSelected && (
                            <>
                              <span className="truncate max-w-[180px]">{inv.billToName}</span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{inv.terminLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-800">
                            {formatRupiahWithPrefix(inv.grandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenPdf(inv)}
                        title="Lihat PDF A4"
                        aria-label={`Lihat PDF ${inv.invoiceNumber}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenVerifyPayment(inv)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                      >
                        Verifikasi Bayar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Matrix: Vgreen Sheet Query OR Selected Customer Invoice Ledger */}
      {isVgreenSelected ? (
        <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Status Penagihan Proyek CLX (Sumber: Sheet Query)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hanya menampilkan baris dengan EPC Name = &quot;CLX&quot; dan Cons WO Number terisi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('projects')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
            >
              Buka Direktori Proyek ({projectSummaries.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Project / Location (Col F)</th>
                  <th className="py-2.5 px-4">Charging Type (Col C)</th>
                  <th className="py-2.5 px-4">Cons WO No. (Col W)</th>
                  <th className="py-2.5 px-4">Termin Progress</th>
                  <th className="py-2.5 px-4 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {projectSummaries.slice(0, 5).map((proj) => {
                  const matchingRow = filteredQueryRows.find(
                    (q) =>
                      q.chargingType === proj.chargingType &&
                      q.projectLocation === proj.projectLocation
                  );
                  return (
                    <tr key={proj.projectKey} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {proj.projectLocation}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{proj.chargingType}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{proj.consWoNumber}</td>
                      <td className="py-3 px-4 tabular-nums">
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              proj.termin35 ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }
                          >
                            35% {proj.termin35 ? '✓' : '—'}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span
                            className={
                              proj.termin60 ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }
                          >
                            60% {proj.termin60 ? '✓' : '—'}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span
                            className={
                              proj.termin5 ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }
                          >
                            5% {proj.termin5 ? '✓' : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {proj.nextAllowedTermin && matchingRow ? (
                          <button
                            type="button"
                            onClick={() =>
                              onCreateInvoiceForProject(matchingRow, proj.nextAllowedTermin!)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#142B4F] transition-colors whitespace-nowrap"
                          >
                            <Clock className="h-3 w-3" />
                            <span>Buat Termin {proj.nextAllowedTermin}%</span>
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">Selesai 100%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Riwayat Invoice · {selectedCustomer}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar seluruh tagihan yang telah diterbitkan untuk customer terpilih
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
            >
              Kelola di Daftar Invoice
            </button>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Belum ada invoice untuk {selectedCustomer}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-4">No. Invoice &amp; Tanggal</th>
                    <th className="py-2.5 px-4">Item / Proyek &amp; WO/PO</th>
                    <th className="py-2.5 px-4">Termin</th>
                    <th className="py-2.5 px-4 text-right">Grand Total</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredInvoices.slice(0, 8).map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 tabular-nums">
                        <div className="font-mono font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateDdMmmYyyy(inv.invoiceDate || inv.invoiceDateDisplay)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {inv.items[0]?.description || inv.projectLocation}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {inv.consWoNumber || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {inv.terminLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiahWithPrefix(inv.grandTotal)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {inv.paymentStatus === 'PAID' ? (
                          <span className="font-semibold text-emerald-700">Terbayar</span>
                        ) : (
                          <span className="font-semibold text-amber-700">Belum Bayar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
