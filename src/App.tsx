import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type {
  ActiveTab,
  AppSettings,
  InvoiceMode,
  InvoiceRecord,
  QueryRow,
  TerminPercent,
} from './types/invoice';
import {
  DEFAULT_SETTINGS,
  buildRetentionReminders,
} from './utils/invoiceLogic';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  appendInvoiceRow,
  ensureInvoicesSheet,
  readInvoicesSheet,
  readQuerySheet,
  updateInvoiceRow,
} from './services/googleSheets';
import { SANDBOX_INVOICES, SANDBOX_QUERY_ROWS } from './data/sandboxData';
import { generateInvoicePdf } from './utils/pdfGenerator';
import { ClxLogoMark } from './components/ClxLogo';
import { SignInGate } from './components/SignInGate';
import { DashboardView } from './components/DashboardView';
import { InvoiceListView } from './components/InvoiceListView';
import { ProjectMatrixView } from './components/ProjectMatrixView';
import { RemindersView } from './components/RemindersView';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { PaymentModal } from './components/PaymentModal';
import { InvoicePdfModal } from './components/InvoicePdfModal';
import { SettingsModal } from './components/SettingsModal';
import {
  BellRing,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'clx_invoice_app_settings_v1';

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isSandbox, setIsSandbox] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' || params.get('sandbox') === '1';
  });
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  const [queryRows, setQueryRows] = useState<QueryRow[]>(() =>
    isSandbox ? SANDBOX_QUERY_ROWS : []
  );
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() =>
    isSandbox ? SANDBOX_INVOICES : []
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<InvoiceMode>('NEW');
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [preselectedRow, setPreselectedRow] = useState<QueryRow | null>(null);
  const [preselectedTermin, setPreselectedTermin] = useState<TerminPercent | undefined>(undefined);

  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRecord | null>(null);
  const [pdfModalInvoice, setPdfModalInvoice] = useState<InvoiceRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const referenceDateIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 5000);
  }, []);

  const syncWithGoogleSheets = useCallback(
    async (tokenOverride?: string, activeSettings = settings) => {
      const token = tokenOverride || getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      setIsSyncing(true);
      setSyncError(null);
      try {
        const [qRows, sheetSetup] = await Promise.all([
          readQuerySheet(activeSettings.spreadsheetId, token, activeSettings.querySheetName),
          ensureInvoicesSheet(
            activeSettings.spreadsheetId,
            token,
            activeSettings.invoicesSheetName
          ),
        ]);

        const invRows = await readInvoicesSheet(
          activeSettings.spreadsheetId,
          token,
          sheetSetup.sheetName
        );

        setQueryRows(qRows);
        setInvoices(invRows);
        if (sheetSetup.created) {
          showToast(
            `Tab baru "${sheetSetup.sheetName}" berhasil dibuat otomatis di Google Sheet.`
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Gagal menyinkronkan data dengan Google Sheets.';
        setSyncError(message);
      } finally {
        setIsSyncing(false);
      }
    },
    [settings, showToast]
  );

  useEffect(() => {
    const unsub = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        setIsSandbox(false);
        syncWithGoogleSheets(token);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, [syncWithGoogleSheets]);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        setIsSandbox(false);
        await syncWithGoogleSheets(res.accessToken);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Login Google dibatalkan atau gagal.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEnterSandbox = () => {
    setIsSandbox(true);
    setNeedsAuth(false);
    setQueryRows(SANDBOX_QUERY_ROWS);
    setInvoices(SANDBOX_INVOICES);
    setSyncError(null);
    showToast('Mode Sandbox Simulasi aktif dengan data sampel PT. CLX.');
  };

  const handleLogout = async () => {
    if (isSandbox) {
      setIsSandbox(false);
      setNeedsAuth(true);
      setQueryRows([]);
      setInvoices([]);
      return;
    }
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setQueryRows([]);
    setInvoices([]);
  };

  const handleSaveSettings = (next: AppSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    showToast('Pengaturan disimpan.');
    if (!isSandbox && getAccessToken()) {
      syncWithGoogleSheets(undefined, next);
    }
  };

  const openCreateForm = (
    mode: InvoiceMode,
    row: QueryRow | null = null,
    termin?: TerminPercent
  ) => {
    setEditingInvoice(null);
    setFormMode(mode);
    setPreselectedRow(row);
    setPreselectedTermin(termin);
    setFormOpen(true);
  };

  const openEditForm = (invoice: InvoiceRecord) => {
    setEditingInvoice(invoice);
    setFormMode(invoice.mode);
    setPreselectedRow(null);
    setPreselectedTermin(undefined);
    setFormOpen(true);
  };

  const handleSaveInvoice = async (invoice: InvoiceRecord, isEdit: boolean) => {
    setIsSaving(true);
    setSyncError(null);
    try {
      if (isSandbox) {
        if (isEdit) {
          setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? invoice : item)));
          showToast(`Invoice ${invoice.invoiceNumber} berhasil diperbarui (Sandbox).`);
        } else {
          setInvoices((prev) => [...prev, invoice]);
          showToast(`Invoice ${invoice.invoiceNumber} berhasil diterbitkan (Sandbox).`);
        }
        setFormOpen(false);
        return;
      }

      const token = getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        throw new Error('Sesi Google Anda berakhir. Silakan Sign in with Google kembali.');
      }

      if (isEdit) {
        const updated = await updateInvoiceRow(
          settings.spreadsheetId,
          token,
          invoice,
          settings.invoicesSheetName
        );
        setInvoices((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast(`Invoice ${updated.invoiceNumber} berhasil diperbarui di Google Sheet.`);
      } else {
        const created = await appendInvoiceRow(
          settings.spreadsheetId,
          token,
          invoice,
          settings.invoicesSheetName
        );
        setInvoices((prev) => [...prev, created]);
        showToast(`Invoice ${created.invoiceNumber} langsung tersimpan ke Google Sheet.`);
      }
      setFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan invoice.';
      setSyncError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPayment = async (
    invoice: InvoiceRecord,
    payload: {
      paymentStatus: 'PAID' | 'UNPAID';
      paidDate: string;
      paymentRef: string;
      paymentNote: string;
    }
  ) => {
    setIsSaving(true);
    setSyncError(null);
    const updatedInvoice: InvoiceRecord = {
      ...invoice,
      paymentStatus: payload.paymentStatus,
      paidDate: payload.paidDate,
      paymentRef: payload.paymentRef,
      paymentNote: payload.paymentNote,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (isSandbox) {
        setInvoices((prev) =>
          prev.map((item) => (item.id === updatedInvoice.id ? updatedInvoice : item))
        );
        setPaymentModalInvoice(null);
        showToast(`Pembayaran ${updatedInvoice.invoiceNumber} terverifikasi (Sandbox).`);
        return;
      }

      const token = getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        throw new Error('Sesi Google Anda berakhir. Silakan login kembali.');
      }

      const saved = await updateInvoiceRow(
        settings.spreadsheetId,
        token,
        updatedInvoice,
        settings.invoicesSheetName
      );
      setInvoices((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      setPaymentModalInvoice(null);
      showToast(`Pembayaran ${saved.invoiceNumber} berhasil diverifikasi di Google Sheet.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memverifikasi pembayaran.';
      setSyncError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const urgentReminderCount = useMemo(() => {
    return buildRetentionReminders(queryRows, invoices, referenceDateIso).filter(
      (r) => r.urgency === 'OVERDUE' || r.urgency === 'DUE_SOON'
    ).length;
  }, [queryRows, invoices, referenceDateIso]);

  if (needsAuth && !isSandbox) {
    return (
      <SignInGate
        spreadsheetId={settings.spreadsheetId}
        onChangeSpreadsheetId={(id) => setSettings((s) => ({ ...s, spreadsheetId: id }))}
        onGoogleSignIn={handleGoogleSignIn}
        onEnterSandbox={handleEnterSandbox}
        isLoggingIn={isLoggingIn}
        authError={authError}
      />
    );
  }

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Daftar Invoice', icon: FileText },
    { id: 'projects', label: 'Proyek & Termin CLX', icon: FolderKanban },
    {
      id: 'reminders',
      label: 'Reminder 5% (1 Thn)',
      icon: BellRing,
      badge: urgentReminderCount > 0 ? urgentReminderCount : undefined,
    },
  ];

  const activeTabTitle: Record<ActiveTab, string> = {
    dashboard: 'Executive Summary Dashboard',
    invoices: 'Ledger & Manajemen Invoice',
    projects: 'Direktori Proyek CLX & Kontrol Termin',
    reminders: 'Reminder Retensi Termin 5% (Kolom Y + 1 Tahun)',
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Deep Executive Navy Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#0A192F] text-slate-200 border-r border-slate-900">
        <div className="p-5 space-y-7">
          <div className="flex items-center gap-3 px-1">
            <ClxLogoMark size={40} framed />
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight text-white truncate">
                PT. CLX
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Connectivity Leads eXcellence
              </div>
            </div>
          </div>

          <nav aria-label="Navigasi Utama" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white/12 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-mono font-bold tabular-nums ${
                        isActive ? 'text-amber-300' : 'text-amber-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="px-1">
            <div className="text-xs font-semibold text-white truncate">
              {isSandbox
                ? 'Mode Sandbox Simulasi'
                : user?.displayName || user?.email || 'Google Connected'}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {isSandbox ? 'Data sampel lokal' : user?.email || 'Google Sheets API Aktif'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Pengaturan</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar sesi"
              title="Keluar"
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col justify-between bg-[#0A192F] text-white p-5 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ClxLogoMark size={34} framed />
                  <span className="font-display text-base font-bold text-white">PT. CLX</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Tutup menu"
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-white/12 text-white' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="border-t border-white/10 pt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200"
              >
                Pengaturan
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-red-300"
              >
                Keluar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur px-4 sm:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-[#0A192F] truncate">
                  {activeTabTitle[activeTab]}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isSandbox ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <span>Hubungkan Google Sheets</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => syncWithGoogleSheets()}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {isSyncing ? 'Menyinkronkan...' : 'Sync Sheet'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openCreateForm('NEW')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#142B4F] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Buat Invoice</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1400px] w-full mx-auto space-y-5">
          {isSandbox && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900">
              <span>
                Anda sedang melihat <strong>Mode Sandbox Simulasi</strong> dengan data sampel CLX.
                Hubungkan akun Google Anda untuk membaca &amp; menyimpan langsung ke Google Sheets.
              </span>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="font-semibold underline underline-offset-4 hover:text-amber-950 whitespace-nowrap"
              >
                Sign in with Google
              </button>
            </div>
          )}

          {syncError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              <span>{syncError}</span>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                className="font-semibold underline"
              >
                Tutup
              </button>
            </div>
          )}

          {toastMessage && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800"
            >
              {toastMessage}
            </div>
          )}

          {isSyncing && queryRows.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  queryRows={queryRows}
                  invoices={invoices}
                  referenceDateIso={referenceDateIso}
                  onNavigateTab={setActiveTab}
                  onCreateInvoiceForProject={(row, termin) =>
                    openCreateForm('NEW', row, termin)
                  }
                  onCreateNewInvoice={(mode) => openCreateForm(mode)}
                  onOpenPdf={(inv) => setPdfModalInvoice(inv)}
                  onOpenVerifyPayment={(inv) => setPaymentModalInvoice(inv)}
                />
              )}

              {activeTab === 'invoices' && (
                <InvoiceListView
                  invoices={invoices}
                  onCreateNew={(mode) => openCreateForm(mode)}
                  onEditInvoice={(inv) => openEditForm(inv)}
                  onOpenPdf={(inv) => setPdfModalInvoice(inv)}
                  onDownloadPdf={(inv) => void generateInvoicePdf(inv)}
                  onOpenVerifyPayment={(inv) => setPaymentModalInvoice(inv)}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectMatrixView
                  queryRows={queryRows}
                  invoices={invoices}
                  onCreateInvoiceForProject={(row, termin, mode) =>
                    openCreateForm(mode || 'NEW', row, termin)
                  }
                  onOpenPdf={(inv) => setPdfModalInvoice(inv)}
                />
              )}

              {activeTab === 'reminders' && (
                <RemindersView
                  queryRows={queryRows}
                  invoices={invoices}
                  referenceDateIso={referenceDateIso}
                  onCreateTermin5Invoice={(row) => openCreateForm('NEW', row, 5)}
                  onCreateNextTerminInvoice={(row) => openCreateForm('NEW', row)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <InvoiceFormModal
        open={formOpen}
        initialMode={formMode}
        editingInvoice={editingInvoice}
        preselectedRow={preselectedRow}
        preselectedTermin={preselectedTermin}
        queryRows={queryRows}
        existingInvoices={invoices}
        settings={settings}
        isSaving={isSaving}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveInvoice}
      />

      <PaymentModal
        invoice={paymentModalInvoice}
        isSaving={isSaving}
        onClose={() => setPaymentModalInvoice(null)}
        onConfirmPayment={handleConfirmPayment}
      />

      <InvoicePdfModal
        invoice={pdfModalInvoice}
        onClose={() => setPdfModalInvoice(null)}
        onDownloadPdf={(inv) => generateInvoicePdf(inv)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
