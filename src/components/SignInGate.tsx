import React, { useState } from 'react';
import { ClxLogoMark } from './ClxLogo';
import { DEFAULT_SPREADSHEET_ID, extractSpreadsheetId } from '../utils/invoiceLogic';
import { ArrowRight, FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface SignInGateProps {
  spreadsheetId: string;
  onChangeSpreadsheetId: (id: string) => void;
  onGoogleSignIn: () => Promise<void>;
  onEnterSandbox: () => void;
  isLoggingIn: boolean;
  authError: string | null;
}

export const SignInGate: React.FC<SignInGateProps> = ({
  spreadsheetId,
  onChangeSpreadsheetId,
  onGoogleSignIn,
  onEnterSandbox,
  isLoggingIn,
  authError,
}) => {
  const [sheetInput, setSheetInput] = useState(
    spreadsheetId || DEFAULT_SPREADSHEET_ID
  );

  const handleSheetChange = (val: string) => {
    setSheetInput(val);
    onChangeSpreadsheetId(extractSpreadsheetId(val));
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F4F6FA]">
      {/* Left Architectural Brand Panel */}
      <div className="lg:col-span-6 bg-[#0A192F] text-white flex flex-col justify-between px-8 py-10 sm:px-14 sm:py-12 relative overflow-hidden">
        {/* Subtle architectural diagonal geometry */}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 800"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
          preserveAspectRatio="none"
        >
          <polygon points="420,0 600,0 600,800 180,800" fill="#94A3B8" />
          <line x1="0" y1="620" x2="600" y2="260" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="0" y1="680" x2="600" y2="320" stroke="#CBD5E1" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex items-center gap-3.5">
          <ClxLogoMark size={46} framed />
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-white">
              PT. CLX
            </div>
            <div className="text-xs text-slate-300">
              PT. Connectivity Leads eXcellence
            </div>
          </div>
        </div>

        <div className="relative z-10 my-12 space-y-6 max-w-lg">
          <div className="text-xs font-medium tracking-wide text-slate-300">
            Executive Billing &amp; Termin Workspace
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.15] text-balance">
            Kontrol Penagihan Termin, Retensi 1 Tahun, dan PDF A4 dalam Satu Sistem.
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-slate-300">
            Terintegrasi langsung dengan sheet <strong className="font-semibold text-white">Query</strong>{' '}
            untuk proyek EPC <strong className="font-semibold text-white">CLX</strong> bernomor WO
            aktif, menjaga urutan penagihan 35% → 60% → 5% tanpa double-billing.
          </p>

          <div className="pt-4 space-y-3 border-t border-white/10 text-xs text-slate-300">
            <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2.5">
              <span className="font-semibold text-white">01. Anti Double-Billing</span>
              <span className="text-right text-slate-300">Kunci otomatis 35% → 60% → 5%</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2.5">
              <span className="font-semibold text-white">02. Migrasi Invoice Lama</span>
              <span className="text-right text-slate-300">Penomoran otomatis bebas duplikat</span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-white">03. Reminder Retensi 5%</span>
              <span className="text-right text-slate-300">Jatuh tempo 1 tahun dari Kolom Y</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          Jl. M. Ali 2 No. 19, Depok · clx.central@gmail.com
        </div>
      </div>

      {/* Right Google Sheets Connection Panel */}
      <div className="lg:col-span-6 flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Hubungkan Google Sheets
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Masuk dengan akun Google yang memiliki akses edit ke spreadsheet database proyek.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signin-sheet-id"
              className="block text-xs font-semibold text-slate-700"
            >
              Link atau ID Google Spreadsheet
            </label>
            <div className="relative">
              <FileSpreadsheet className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="signin-sheet-id"
                type="text"
                value={sheetInput}
                onChange={(e) => handleSheetChange(e.target.value)}
                placeholder="Paste Google Sheet URL or ID"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-mono text-slate-800 focus:border-[#0A192F] focus:bg-white focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Sumber: <span className="font-mono text-slate-700">Query</span> · Penyimpanan:{' '}
              <span className="font-mono text-slate-700">Invoices_DB</span> (otomatis dibuat)
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isLoggingIn}
              className="gsi-material-button w-full"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Menghubungkan ke Google...' : 'Sign in with Google'}
                </span>
              </div>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200" />
              <span className="mx-3 shrink text-[11px] text-slate-400">atau</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              onClick={onEnterSandbox}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              <span>Buka Sandbox Simulasi</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </div>

          <div className="flex items-start gap-2.5 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
            <span>
              Token akses Google hanya disimpan di memori sesi browser dan tidak pernah dikirim ke
              pihak ketiga.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
