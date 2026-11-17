import React from 'react';
import type { InvoiceRecord } from '../types/invoice';
import { formatRupiah } from '../utils/invoiceLogic';
import { ClxLogoMark } from './ClxLogo';
import { FileDown, Printer, X } from 'lucide-react';

interface InvoicePdfModalProps {
  invoice: InvoiceRecord | null;
  onClose: () => void;
  onDownloadPdf: (invoice: InvoiceRecord) => void | Promise<void>;
}

export const InvoicePdfModal: React.FC<InvoicePdfModalProps> = ({
  invoice,
  onClose,
  onDownloadPdf,
}) => {
  if (!invoice) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
    >
      <div className="my-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-slate-100 shadow-2xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3.5">
          <div>
            <h2 id="pdf-preview-title" className="font-display text-sm font-bold text-slate-900">
              Preview Dokumen A4 · {invoice.invoiceNumber}
            </h2>
            <p className="text-xs text-slate-500">
              {invoice.projectLocation} · {invoice.terminLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print A4</span>
            </button>
            <button
              type="button"
              onClick={() => void onDownloadPdf(invoice)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A192F] px-4 py-2 text-xs font-medium text-white hover:bg-[#142B4F] transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup preview PDF"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live A4 Sheet Canvas */}
        <div className="max-h-[80vh] overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div
            id="a4-invoice-sheet"
            className="relative w-full max-w-[794px] min-h-[1040px] bg-white shadow-lg border border-slate-200 flex flex-col justify-between overflow-hidden text-slate-900"
          >
            <div>
              {/* Header Architectural Band */}
              <div className="relative border-b-2 border-[#0A1F44] px-10 py-6 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-4 z-10">
                  <ClxLogoMark size={60} />
                  <div>
                    <div className="font-display text-2xl font-extrabold tracking-tight text-[#0A1F44]">
                      PT. CLX
                    </div>
                    <div className="text-xs font-semibold tracking-wide text-[#5C7698]">
                      PT. Connectivity Leads eXcellence
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-500 max-w-md">
                      Jl. M. Ali 2 No. 19 RT 007 RW 004 Tanah Baru, Beji, Kota Depok, Jawa Barat
                      16426
                      <br />E : <span className="text-sky-700">clx.central@gmail.com</span> · T : +62
                      82148581879
                    </div>
                  </div>
                </div>

                {/* Geometric Top-Right Ribbon in Deep Navy & Steel */}
                <div
                  aria-hidden="true"
                  className="hidden sm:block absolute right-0 top-0 bottom-0 w-64 pointer-events-none"
                >
                  <svg viewBox="0 0 260 110" className="h-full w-full" preserveAspectRatio="none">
                    <polygon points="55,0 260,0 260,110 15,110" fill="#0A1F44" />
                    <polygon points="34,0 44,0 4,110 -6,110" fill="#5C7698" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <div className="px-10 pt-8 pb-4 flex justify-end">
                <div className="text-right">
                  <h1 className="font-display text-4xl font-extrabold tracking-tight text-[#0A1F44]">
                    INVOICE
                  </h1>
                  <div className="mt-1 ml-auto h-0.5 w-24 bg-[#5C7698]" />
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="px-10 py-4 grid grid-cols-1 md:grid-cols-12 gap-8 text-xs">
                <div className="md:col-span-6 space-y-1.5">
                  <div className="text-[11px] font-bold tracking-wider text-[#5C7698]">BILL TO</div>
                  <div className="text-sm font-bold text-[#0A1F44]">{invoice.billToName}</div>
                  <p className="leading-relaxed text-slate-600">{invoice.billToAddress}</p>
                </div>

                <div className="md:col-span-6 space-y-1.5">
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">Invoice No.</span>
                    <span className="col-span-8 font-mono font-bold text-[#0A1F44]">
                      : {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">Supplier</span>
                    <span className="col-span-8 font-bold text-[#0A1F44]">
                      : PT. Connectivity Leads eXcellence
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">Invoice Date</span>
                    <span className="col-span-8 text-slate-800">
                      : {invoice.invoiceDateDisplay || invoice.invoiceDate}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">Project Type</span>
                    <span className="col-span-8 text-slate-800">: {invoice.chargingType}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">WO No.</span>
                    <span className="col-span-8 font-mono text-slate-800">
                      : {invoice.consWoNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">Period</span>
                    <span className="col-span-8 text-slate-800">: {invoice.period}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    <span className="col-span-4 text-slate-500">No. Efaktur</span>
                    <span className="col-span-8 font-mono text-slate-800">
                      : {invoice.noEfaktur || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items & Summary Table */}
              <div className="px-10 py-6">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-[#0A1F44] text-white">
                      <th className="border border-slate-700 py-2.5 px-2 text-center w-12">NO.</th>
                      <th className="border border-slate-700 py-2.5 px-3 text-left">
                        ITEM DESCRIPTION
                      </th>
                      <th className="border border-slate-700 py-2.5 px-2 text-center w-14">QTY</th>
                      <th className="border border-slate-700 py-2.5 px-2 text-center w-16">UOM</th>
                      <th className="border border-slate-700 py-2.5 px-3 text-right w-32">
                        UNIT PRICE
                      </th>
                      <th className="border border-slate-700 py-2.5 px-3 text-right w-32">
                        AMOUNT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="border border-slate-300 py-2.5 px-2 text-center tabular-nums">
                          {i + 1}
                        </td>
                        <td className="border border-slate-300 py-2.5 px-3 font-medium text-slate-900">
                          {item.description}
                        </td>
                        <td className="border border-slate-300 py-2.5 px-2 text-center tabular-nums">
                          {item.qty}
                        </td>
                        <td className="border border-slate-300 py-2.5 px-2 text-center">
                          {item.uom}
                        </td>
                        <td className="border border-slate-300 py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatRupiah(item.unitPrice)}
                        </td>
                        <td className="border border-slate-300 py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatRupiah(item.amount)}
                        </td>
                      </tr>
                    ))}

                    {/* Summary Rows */}
                    <tr>
                      <td
                        colSpan={4}
                        rowSpan={4}
                        className="border border-slate-300 bg-slate-50/70 p-4 align-top"
                      >
                        <div className="text-[11px] font-bold text-[#5C7698]">
                          TOTAL AMOUNT IN WORDS
                        </div>
                        <div className="mt-3 text-sm font-bold text-[#0A1F44] leading-relaxed">
                          {invoice.amountInWords}
                        </div>
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-bold text-slate-700">
                        TOTAL
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-mono font-semibold tabular-nums">
                        {formatRupiah(invoice.contractAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 py-2 px-3 text-right font-bold text-slate-700">
                        {invoice.terminLabel}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-mono font-semibold tabular-nums">
                        {formatRupiah(invoice.terminAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 py-2 px-3 text-right font-bold text-slate-700">
                        TAX ({invoice.taxRate}%)
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-mono font-semibold tabular-nums">
                        {formatRupiah(invoice.taxAmount)}
                      </td>
                    </tr>
                    <tr className="bg-[#0A1F44] text-white">
                      <td className="border border-slate-800 py-2.5 px-3 text-right font-bold">
                        TOTAL
                      </td>
                      <td className="border border-slate-800 py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        {formatRupiah(invoice.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Info & Signature */}
              <div className="px-10 py-4 flex flex-col sm:flex-row items-start justify-between gap-8 text-xs">
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-300 bg-slate-50/60 p-4 min-w-[310px]">
                    <div className="text-xs font-bold text-[#0A1F44] mb-2">PAYMENT INFO</div>
                    <div className="grid grid-cols-12 gap-y-1">
                      <span className="col-span-4 text-slate-600">Bank Name</span>
                      <span className="col-span-8 font-bold text-[#0A1F44]">
                        : BANK CENTRAL ASIA (BCA)
                      </span>
                      <span className="col-span-4 text-slate-600">Bank Account</span>
                      <span className="col-span-8 font-mono font-bold text-[#0A1F44]">
                        : 540-5282841
                      </span>
                      <span className="col-span-4 text-slate-600">Account Name</span>
                      <span className="col-span-8 font-bold text-[#0A1F44]">
                        : PT. CONNECTIVITY LEADS EXCELLENCE
                      </span>
                    </div>
                  </div>

                  {invoice.paymentStatus === 'PAID' && (
                    <div className="inline-block rounded-md border-2 border-emerald-600 px-3 py-1.5 text-[11px] font-bold text-emerald-700 tracking-wide">
                      PAID · VERIFIED ({invoice.paidDate})
                    </div>
                  )}
                </div>

                <div className="text-center min-w-[200px] sm:pt-4 ml-auto">
                  <div className="text-slate-800">
                    {invoice.signatoryCity || 'Jakarta'},{' '}
                    {invoice.invoiceDateDisplay || invoice.period}
                  </div>
                  <div className="mt-16 font-bold text-[#0A1F44] underline underline-offset-4">
                    {invoice.signatoryName || 'Christian'}
                  </div>
                  <div className="mt-1 text-slate-600">
                    {invoice.signatoryTitle || 'President Director'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Architectural Footer */}
            <div className="relative mt-10 pt-4 pb-5 px-10 flex items-end justify-between border-t border-slate-100">
              <div
                aria-hidden="true"
                className="hidden sm:block absolute left-0 bottom-0 w-72 h-12 pointer-events-none"
              >
                <svg viewBox="0 0 280 48" className="h-full w-full" preserveAspectRatio="none">
                  <polygon points="0,16 215,16 245,48 0,48" fill="#0A1F44" />
                  <polyline
                    points="0,8 220,8 254,48"
                    fill="none"
                    stroke="#5C7698"
                    strokeWidth="4"
                  />
                </svg>
              </div>
              <div className="sm:ml-auto text-[10px] text-slate-500 leading-relaxed">
                <div className="font-bold text-[#0A1F44]">PT. Connectivity Leads eXcellence</div>
                <div>Head Office</div>
                <div>
                  Jl. M. Ali 2 No. 19, RT 007 RW 004 Tanah Baru, Beji, Kota Depok, Jawa Barat 16426
                </div>
                <div>
                  E : <span className="text-sky-700">clx.central@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
