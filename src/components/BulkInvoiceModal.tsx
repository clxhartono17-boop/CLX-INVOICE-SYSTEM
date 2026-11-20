import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  CustomerRecord,
  InvoiceMode,
  InvoiceRecord,
  QueryRow,
} from '../types/invoice';
import {
  BULK_TEMPLATE_HEADERS,
  downloadBulkExcelTemplate,
  parseBulkInvoiceRows,
  parseExcelFileToGrid,
} from '../utils/bulkInvoiceLogic';
import {
  DEFAULT_VGREEN_CUSTOMER,
  extractSpreadsheetId,
  formatPeriodDisplay,
  formatRupiahWithPrefix,
} from '../utils/invoiceLogic';
import { ConfirmDialog } from './ConfirmDialog';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Link2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

interface BulkInvoiceModalProps {
  open: boolean;
  initialMode: InvoiceMode;
  queryRows: QueryRow[];
  existingInvoices: InvoiceRecord[];
  customers: CustomerRecord[];
  settings: AppSettings;
  isSandbox: boolean;
  isSaving: boolean;
  onClose: () => void;
  onFetchGoogleSheetGrid: (spreadsheetId: string, sheetName: string) => Promise<unknown[][]>;
  onCommitBulk: (
    invoices: InvoiceRecord[],
    newCustomers: Array<{ name: string; address: string }>
  ) => Promise<void>;
}

type BulkSourceTab = 'EXCEL' | 'GSHEET';

export const BulkInvoiceModal: React.FC<BulkInvoiceModalProps> = ({
  open,
  initialMode,
  queryRows,
  existingInvoices,
  customers,
  settings,
  isSandbox,
  isSaving,
  onClose,
  onFetchGoogleSheetGrid,
  onCommitBulk,
}) => {
  const [mode, setMode] = useState<InvoiceMode>(initialMode);
  const [sourceTab, setSourceTab] = useState<BulkSourceTab>('EXCEL');
  const [rawGrid, setRawGrid] = useState<unknown[][]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);

  const [sheetUrlOrId, setSheetUrlOrId] = useState(settings.spreadsheetId);
  const [sheetTabName, setSheetTabName] = useState('Bulk_Import');
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setSourceTab('EXCEL');
    setRawGrid([]);
    setSourceLabel('');
    setLoadError(null);
    setSheetUrlOrId(settings.spreadsheetId);
    setSheetTabName('Bulk_Import');
    setShowFormatGuide(false);
    setShowConfirm(false);
  }, [open, initialMode, settings.spreadsheetId]);

  const parsedResult = useMemo(() => {
    if (rawGrid.length === 0) return null;
    return parseBulkInvoiceRows(rawGrid, {
      mode,
      existingInvoices,
      queryRows,
      customers,
      settings,
    });
  }, [rawGrid, mode, existingInvoices, queryRows, customers, settings]);

  const totalValidGrandAmount = useMemo(
    () => (parsedResult ? parsedResult.validInvoices.reduce((s, i) => s + i.grandTotal, 0) : 0),
    [parsedResult]
  );

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingSource(true);
    setLoadError(null);
    try {
      const grid = await parseExcelFileToGrid(file);
      if (grid.length <= 1) {
        setLoadError('File tidak memiliki baris data invoice (hanya header atau kosong).');
        setRawGrid([]);
        setSourceLabel('');
      } else {
        setRawGrid(grid);
        setSourceLabel(`File: ${file.name}`);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Gagal membaca file Excel/CSV.');
      setRawGrid([]);
    } finally {
      setIsLoadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchGoogleSheet = async () => {
    const targetId = extractSpreadsheetId(sheetUrlOrId);
    if (!targetId) {
      setLoadError('Masukkan URL atau Spreadsheet ID Google Sheets yang valid.');
      return;
    }
    if (!sheetTabName.trim()) {
      setLoadError('Masukkan nama Tab Sheet sumber data (contoh: Bulk_Import).');
      return;
    }
    setIsLoadingSource(true);
    setLoadError(null);
    try {
      const grid = await onFetchGoogleSheetGrid(targetId, sheetTabName.trim());
      if (grid.length <= 1) {
        setLoadError(`Tab "${sheetTabName.trim()}" kosong atau hanya berisi baris header.`);
        setRawGrid([]);
      } else {
        setRawGrid(grid);
        setSourceLabel(`Google Sheet Tab: ${sheetTabName.trim()}`);
      }
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Gagal mengambil data dari Google Spreadsheet.'
      );
      setRawGrid([]);
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleLoadSandboxSample = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const period = formatPeriodDisplay(todayIso);
    const isLegacy = mode === 'LEGACY';

    const sampleGrid: unknown[][] = [
      [...BULK_TEMPLATE_HEADERS],
      [
        DEFAULT_VGREEN_CUSTOMER.name,
        DEFAULT_VGREEN_CUSTOMER.address,
        'KF 0042 Semarang Tengah',
        'BSS 6 Slot 1 Phase',
        'VGID-WO/BD/2026/IX/1142',
        35,
        todayIso,
        period,
        'KF 0042 Semarang Tengah',
        1,
        'Unit',
        8500000,
        11,
        '',
        isLegacy ? '840/INV/CLX/VIII/2026' : '',
        isLegacy ? 'PAID' : '',
        isLegacy ? '2026-08-30' : '',
        isLegacy ? 'BCA-TRF/20260830/110' : '',
      ],
      [
        'PT Nusantara Energi Infrastruktur',
        '',
        'Maintenance Gardu & Panel Karawang',
        'Preventive Maintenance',
        'PO/NEI/2026/XI/021',
        35,
        todayIso,
        period,
        'Preventive Maintenance Panel Distribusi & Kalibrasi Karawang',
        1,
        'Lot',
        12000000,
        11,
        '',
        isLegacy ? '841/INV/CLX/VIII/2026' : '',
        isLegacy ? 'UNPAID' : '',
        '',
        '',
      ],
    ];
    setLoadError(null);
    setRawGrid(sampleGrid);
    setSourceLabel(`Contoh Data Bulk (${mode === 'LEGACY' ? 'Legacy' : 'Invoice Baru'})`);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-invoice-modal-title"
      >
        <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A192F] text-white">
                <FileSpreadsheet className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2
                  id="bulk-invoice-modal-title"
                  className="font-display text-base font-bold text-slate-900"
                >
                  Pembuatan Invoice Sekaligus (Bulk Upload)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Import banyak invoice sekaligus via file Excel (.xlsx/.csv) atau tab Google Spreadsheet
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal bulk invoice"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Step 1: Mode & Template Download */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  1. Pilih Mode Bulk Invoice
                </div>
                <div className="inline-flex rounded-lg bg-slate-200/80 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('NEW')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      mode === 'NEW'
                        ? 'bg-[#0A192F] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Invoice Baru (Auto Nomor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('LEGACY')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      mode === 'LEGACY'
                        ? 'bg-[#0A192F] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Invoice Lama (Legacy)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBulkExcelTemplate(mode)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5 text-[#0A192F]" />
                  <span>Download Format Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFormatGuide((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                >
                  <span>Panduan Kolom</span>
                  {showFormatGuide ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {showFormatGuide && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
                <div className="font-semibold text-slate-900">
                  Struktur Kolom Template ({BULK_TEMPLATE_HEADERS.length} Kolom)
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Gunakan tombol <strong>Download Format Excel (.xlsx)</strong> di atas untuk
                  mendapatkan file siap isi lengkap dengan tab <code>Panduan_Kolom</code>. Untuk{' '}
                  <strong>Customer Vgreen</strong>, proyek otomatis dicocokkan ke sheet{' '}
                  <code>Query</code> dan dijaga aturan anti double-billing (35% &rarr; 60% &rarr;
                  5%). Untuk <strong>Customer Non-Vgreen</strong>, isi kolom{' '}
                  <code>Item Description</code> secara manual. Penomoran mode{' '}
                  <strong>Invoice Baru</strong> otomatis berlanjut (counting) lintas customer.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {BULK_TEMPLATE_HEADERS.map((col) => (
                    <code
                      key={col}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {col}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Data Source Tabs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  2. Pilih Sumber Data
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceTab('EXCEL');
                      setLoadError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      sourceTab === 'EXCEL'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload File Excel / CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceTab('GSHEET');
                      setLoadError(null);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      sourceTab === 'GSHEET'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Ambil dari Google Spreadsheet</span>
                  </button>
                </div>
              </div>

              {sourceTab === 'EXCEL' ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-sm font-semibold text-slate-900">
                      Unggah file .xlsx, .xls, atau .csv sesuai template
                    </div>
                    <p className="text-xs text-slate-500">
                      Worksheet pertama akan dibaca dan divalidasi otomatis sebelum disimpan ke{' '}
                      <code>Invoices_DB</code>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      id="bulk-excel-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <label
                      htmlFor="bulk-excel-file-input"
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4F] transition-colors whitespace-nowrap"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isLoadingSource ? 'Membaca File...' : 'Pilih File Excel'}</span>
                    </label>
                    {isSandbox && (
                      <button
                        type="button"
                        onClick={handleLoadSandboxSample}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                        <span>Muat Contoh Data Bulk (Sandbox)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  {isSandbox ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                      <span>
                        Pengambilan langsung dari Google Spreadsheet memerlukan login Google Sheets
                        aktif. Di Mode Sandbox, Anda tetap bisa menguji alur bulk memakai contoh
                        data atau upload file Excel lokal.
                      </span>
                      <button
                        type="button"
                        onClick={handleLoadSandboxSample}
                        className="font-semibold underline underline-offset-4 whitespace-nowrap"
                      >
                        Muat Contoh Data Bulk
                      </button>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-6 space-y-1">
                      <label
                        htmlFor="bulk-gsheet-url"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Link atau Spreadsheet ID Sumber
                      </label>
                      <input
                        id="bulk-gsheet-url"
                        type="text"
                        value={sheetUrlOrId}
                        onChange={(e) => setSheetUrlOrId(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label
                        htmlFor="bulk-gsheet-tab"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Nama Tab Sheet
                      </label>
                      <input
                        id="bulk-gsheet-tab"
                        type="text"
                        value={sheetTabName}
                        onChange={(e) => setSheetTabName(e.target.value)}
                        placeholder="Contoh: Bulk_Import"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={handleFetchGoogleSheet}
                        disabled={isLoadingSource || isSandbox}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0A192F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#142B4F] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>{isLoadingSource ? 'Mengambil...' : 'Ambil Data Sheet'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loadError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{loadError}</span>
                </div>
              )}
            </div>

            {/* Step 3: Validation Preview Table */}
            {parsedResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      3. Preview &amp; Validasi ({sourceLabel})
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs tabular-nums">
                      <span className="text-slate-700">
                        Total Baris: <strong>{parsedResult.rows.length}</strong>
                      </span>
                      <span className="text-emerald-700 font-semibold">
                        Valid: {parsedResult.validCount}
                      </span>
                      {parsedResult.errorCount > 0 && (
                        <span className="text-red-700 font-semibold">
                          Error: {parsedResult.errorCount}
                        </span>
                      )}
                      <span className="text-slate-400">·</span>
                      <span className="font-mono font-bold text-slate-900">
                        Total Nilai Valid: {formatRupiahWithPrefix(totalValidGrandAmount)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRawGrid([]);
                      setSourceLabel('');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4"
                  >
                    Bersihkan Preview
                  </button>
                </div>

                {parsedResult.newCustomersToCreate.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-900">
                    <strong>{parsedResult.newCustomersToCreate.length} customer baru</strong>{' '}
                    ({parsedResult.newCustomersToCreate.map((c) => c.name).join(', ')}) akan
                    otomatis ditambahkan ke <code>Customers_DB</code> saat penyimpanan.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Baris</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">No. Invoice</th>
                          <th className="py-2 px-3">Customer &amp; Item</th>
                          <th className="py-2 px-3">Termin</th>
                          <th className="py-2 px-3 text-right">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedResult.rows.map((row) => (
                          <tr
                            key={row.sourceRowNumber}
                            className={row.isValid ? 'bg-white' : 'bg-red-50/40'}
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                              #{row.sourceRowNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 whitespace-nowrap">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Valid</span>
                                </span>
                              ) : (
                                <div className="space-y-0.5 text-red-700">
                                  <span className="inline-flex items-center gap-1 font-semibold">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span>Ditolak</span>
                                  </span>
                                  <div className="text-[11px] leading-snug max-w-[260px]">
                                    {row.errors.join(' ')}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {row.invoice ? (
                                <div>
                                  <div>{row.invoice.invoiceNumber}</div>
                                  <div className="text-[11px] font-normal text-slate-500">
                                    {row.invoice.invoiceDateDisplay} · {row.invoice.period}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 max-w-[260px]">
                              <div className="font-semibold text-slate-900 truncate">
                                {row.customerName}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {row.invoice
                                  ? `${row.invoice.items[0]?.description || row.invoice.projectLocation} · ${row.invoice.consWoNumber}`
                                  : 'Periksa format kolom baris ini'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                              {row.invoice ? (
                                <div>
                                  <div className="font-medium">{row.invoice.terminLabel}</div>
                                  {row.invoice.paymentStatus === 'PAID' && (
                                    <div className="text-[11px] text-emerald-700 font-semibold">
                                      PAID ({row.invoice.paidDate})
                                    </div>
                                  )}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                              {row.invoice ? formatRupiahWithPrefix(row.invoice.grandTotal) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pinned Footer */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-600">
              {parsedResult && parsedResult.validCount > 0 ? (
                <span>
                  Siap menyimpan <strong>{parsedResult.validCount} invoice valid</strong> ke{' '}
                  <code>{settings.invoicesSheetName}</code>
                  {parsedResult.errorCount > 0
                    ? ` (${parsedResult.errorCount} baris error akan dilewati)`
                    : ''}
                  .
                </span>
              ) : (
                <span>Unggah file Excel atau ambil dari Google Spreadsheet untuk memulai.</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving || !parsedResult || parsedResult.validCount === 0}
                onClick={() => setShowConfirm(true)}
                className="rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4F] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {parsedResult && parsedResult.validCount > 0
                  ? `Terbitkan ${parsedResult.validCount} Invoice Valid`
                  : 'Terbitkan Bulk Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="primary"
        title={`Konfirmasi Pembuatan ${parsedResult?.validCount || 0} Invoice Sekaligus`}
        description={`Sebanyak ${parsedResult?.validCount || 0} invoice valid (mode ${mode === 'LEGACY' ? 'Invoice Lama' : 'Invoice Baru'}) akan langsung ditambahkan ke Google Sheet "${settings.invoicesSheetName}".`}
        details={[
          { label: 'Mode Import', value: mode === 'LEGACY' ? 'Invoice Lama (Legacy)' : 'Invoice Baru (Auto Nomor)' },
          { label: 'Jumlah Invoice Valid', value: `${parsedResult?.validCount || 0} Invoice` },
          {
            label: 'Total Nilai (PPN)',
            value: formatRupiahWithPrefix(totalValidGrandAmount),
          },
          ...(parsedResult && parsedResult.newCustomersToCreate.length > 0
            ? [
                {
                  label: 'Customer Baru Ditambahkan',
                  value: `${parsedResult.newCustomersToCreate.length} Customer`,
                },
              ]
            : []),
        ]}
        confirmLabel={`Ya, Simpan ${parsedResult?.validCount || 0} Invoice`}
        isLoading={isSaving}
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => {
          if (!parsedResult) return;
          setShowConfirm(false);
          await onCommitBulk(parsedResult.validInvoices, parsedResult.newCustomersToCreate);
        }}
      />
    </>
  );
};
