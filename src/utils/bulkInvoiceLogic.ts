import * as XLSX from 'xlsx';
import type {
  AppSettings,
  CustomerRecord,
  InvoiceMode,
  InvoiceRecord,
  PaymentStatus,
  QueryRow,
  TerminPercent,
} from '../types/invoice';
import {
  DEFAULT_VGREEN_CUSTOMER,
  calculateInvoiceAmounts,
  extractSequenceNumber,
  formatDateDdMmmYyyy,
  formatPeriodDisplay,
  generateNextInvoiceNumber,
  getTerminLabel,
  isVgreenCustomer,
  makeProjectKey,
  normalizeText,
  parseSheetDateToIso,
  validateInvoiceForm,
} from './invoiceLogic';

export const BULK_TEMPLATE_HEADERS = [
  'Customer Name',
  'Customer Address',
  'Project / Location Name',
  'Project / Charging Type',
  'WO/PO No.',
  'Termin (%)',
  'Invoice Date',
  'Period',
  'Item Description',
  'Qty',
  'UOM',
  'Unit Price (IDR)',
  'Tax Rate (%)',
  'No. Efaktur',
  'Invoice No. (Legacy Only)',
  'Payment Status (Legacy Only)',
  'Paid Date (Legacy Only)',
  'Payment Ref (Legacy Only)',
] as const;

export interface BulkInvoicePreviewRow {
  sourceRowNumber: number; // 1-based row number in Excel/Sheet
  isValid: boolean;
  errors: string[];
  customerName: string;
  isNewCustomer: boolean;
  customerAddress: string;
  invoice: InvoiceRecord | null;
}

export interface BulkParseResult {
  rows: BulkInvoicePreviewRow[];
  validInvoices: InvoiceRecord[];
  newCustomersToCreate: Array<{ name: string; address: string }>;
  validCount: number;
  errorCount: number;
}

/**
 * Parses numeric values cleanly whether they come from Excel numbers (8500000),
 * Indonesian format ("8.500.000", "Rp 8.500.000"), or comma format ("8,500,000").
 */
export function parseLooseNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str) return 0;

  // Strip currency prefix & spaces
  let cleaned = str.replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');

  // Pattern: Indonesian thousands with dots only (e.g., 8.500.000 or 7.650.000)
  if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  } else if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
    // US thousands with commas (e.g., 8,500,000)
    cleaned = cleaned.replace(/,/g, '');
  } else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    // Indonesian thousands + comma decimal (e.g., 8.500.000,50)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTerminValue(raw: unknown): TerminPercent | null {
  const str = String(raw ?? '').trim().replace(/%/g, '');
  const num = Number(str);
  if (num === 35) return 35;
  if (num === 60) return 60;
  if (num === 5) return 5;
  return null;
}

function resolveColumnMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  const matchers: Array<{ key: string; patterns: string[] }> = [
    { key: 'customerName', patterns: ['customer name', 'customer', 'bill to', 'nama customer'] },
    { key: 'customerAddress', patterns: ['customer address', 'alamat customer', 'address', 'alamat'] },
    { key: 'projectLocation', patterns: ['project / location', 'project/location', 'project location', 'location', 'lokasi'] },
    { key: 'chargingType', patterns: ['project / charging', 'charging type', 'project type', 'tipe'] },
    { key: 'woPoNo', patterns: ['wo/po', 'wo no', 'cons wo', 'po no'] },
    { key: 'termin', patterns: ['termin'] },
    { key: 'invoiceDate', patterns: ['invoice date', 'tanggal invoice', 'tgl invoice'] },
    { key: 'period', patterns: ['period', 'periode'] },
    { key: 'itemDescription', patterns: ['item description', 'description', 'deskripsi'] },
    { key: 'qty', patterns: ['qty', 'quantity'] },
    { key: 'uom', patterns: ['uom', 'satuan', 'unit'] },
    { key: 'unitPrice', patterns: ['unit price', 'harga satuan', 'harga', 'amount'] },
    { key: 'taxRate', patterns: ['tax rate', 'tax', 'ppn'] },
    { key: 'noEfaktur', patterns: ['efaktur', 'e-faktur', 'faktur'] },
    { key: 'invoiceNo', patterns: ['invoice no', 'no invoice', 'nomor invoice'] },
    { key: 'paymentStatus', patterns: ['payment status', 'status bayar', 'status pembayaran'] },
    { key: 'paidDate', patterns: ['paid date', 'tanggal bayar', 'tgl bayar'] },
    { key: 'paymentRef', patterns: ['payment ref', 'referensi', 'bukti bayar'] },
  ];

  headerRow.forEach((cell, idx) => {
    const label = String(cell ?? '').trim().toLowerCase();
    if (!label) return;
    for (const m of matchers) {
      if (map[m.key] !== undefined) continue;
      if (m.patterns.some((p) => label.includes(p))) {
        map[m.key] = idx;
      }
    }
  });

  // Fallback positional indices matching BULK_TEMPLATE_HEADERS if header didn't map
  const fallbackKeys = [
    'customerName',
    'customerAddress',
    'projectLocation',
    'chargingType',
    'woPoNo',
    'termin',
    'invoiceDate',
    'period',
    'itemDescription',
    'qty',
    'uom',
    'unitPrice',
    'taxRate',
    'noEfaktur',
    'invoiceNo',
    'paymentStatus',
    'paidDate',
    'paymentRef',
  ];
  const matchedCount = Object.keys(map).length;
  if (matchedCount < 3) {
    fallbackKeys.forEach((key, idx) => {
      if (map[key] === undefined) map[key] = idx;
    });
  }

  return map;
}

/**
 * Parses and validates raw 2D rows (from Excel upload or Google Sheet tab) into
 * BulkInvoicePreviewRow[] for either NEW (auto-numbering) or LEGACY mode.
 */
export function parseBulkInvoiceRows(
  rawRows: unknown[][],
  context: {
    mode: InvoiceMode;
    existingInvoices: InvoiceRecord[];
    queryRows: QueryRow[];
    customers: CustomerRecord[];
    settings: AppSettings;
    todayIso?: string;
  }
): BulkParseResult {
  const { mode, existingInvoices, queryRows, customers, settings } = context;
  const todayIso = context.todayIso || new Date().toISOString().slice(0, 10);

  if (!rawRows || rawRows.length === 0) {
    return {
      rows: [],
      validInvoices: [],
      newCustomersToCreate: [],
      validCount: 0,
      errorCount: 0,
    };
  }

  const firstRowJoined = (rawRows[0] || [])
    .map((c) => String(c ?? '').toLowerCase())
    .join(' ');
  const hasHeader =
    firstRowJoined.includes('customer') ||
    firstRowJoined.includes('termin') ||
    firstRowJoined.includes('unit price') ||
    firstRowJoined.includes('item description');

  const colMap = resolveColumnMap(hasHeader ? rawRows[0] : []);
  const startRowIdx = hasHeader ? 1 : 0;

  const simulatedExisting: InvoiceRecord[] = [...existingInvoices];
  const knownCustomersByName = new Map<string, CustomerRecord>();
  knownCustomersByName.set(
    normalizeText(DEFAULT_VGREEN_CUSTOMER.name).toLowerCase(),
    DEFAULT_VGREEN_CUSTOMER
  );
  for (const c of customers) {
    const key = normalizeText(c.name).toLowerCase();
    if (key) knownCustomersByName.set(key, c);
  }

  const newCustomersMap = new Map<string, { name: string; address: string }>();
  const previewRows: BulkInvoicePreviewRow[] = [];
  const validInvoices: InvoiceRecord[] = [];
  const nowIso = new Date().toISOString();

  const getCell = (row: unknown[], key: string): string => {
    const idx = colMap[key];
    if (idx === undefined) return '';
    const val = row[idx];
    return val === null || val === undefined ? '' : String(val).trim();
  };

  const getRawCell = (row: unknown[], key: string): unknown => {
    const idx = colMap[key];
    if (idx === undefined) return '';
    return row[idx];
  };

  for (let i = startRowIdx; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    const isEmptyRow = row.every((cell) => String(cell ?? '').trim() === '');
    if (isEmptyRow) continue;

    const sourceRowNumber = i + 1;
    const errors: string[] = [];

    const rawCustomerName = normalizeText(getCell(row, 'customerName'));
    const rawCustomerAddr = getCell(row, 'customerAddress');
    const rawProjectLoc = normalizeText(getCell(row, 'projectLocation'));
    const rawChargingType = normalizeText(getCell(row, 'chargingType'));
    const rawWoPo = normalizeText(getCell(row, 'woPoNo'));
    const termin = parseTerminValue(getRawCell(row, 'termin'));
    const rawInvoiceDate = getRawCell(row, 'invoiceDate');
    const rawPeriod = getRawCell(row, 'period');
    const rawItemDesc = normalizeText(getCell(row, 'itemDescription'));
    const qtyRaw = parseLooseNumber(getRawCell(row, 'qty'));
    const qty = qtyRaw > 0 ? qtyRaw : 1;
    const uom = getCell(row, 'uom') || 'Unit';
    const unitPrice = Math.round(parseLooseNumber(getRawCell(row, 'unitPrice')));
    const taxRateRaw = getCell(row, 'taxRate');
    const taxRate = taxRateRaw !== '' ? parseLooseNumber(taxRateRaw) : settings.defaultTaxRate;
    const noEfaktur = getCell(row, 'noEfaktur');
    const rawLegacyInvNo = getCell(row, 'invoiceNo');
    const rawPayStatus = getCell(row, 'paymentStatus').toUpperCase();
    const rawPaidDate = getRawCell(row, 'paidDate');
    const paymentRef = getCell(row, 'paymentRef');

    const effectiveCustomerName = rawCustomerName || DEFAULT_VGREEN_CUSTOMER.name;
    const custKey = effectiveCustomerName.toLowerCase();
    const matchedCustomer = knownCustomersByName.get(custKey);
    const pendingCustomer = newCustomersMap.get(custKey);
    const isNewCustomer = !matchedCustomer;
    const effectiveAddress =
      rawCustomerAddr || matchedCustomer?.address || pendingCustomer?.address || '';
    const rowIsVgreen = isVgreenCustomer(effectiveCustomerName);

    if (isNewCustomer && !effectiveAddress) {
      errors.push(
        `Customer baru "${effectiveCustomerName}" wajib mengisi kolom Customer Address.`
      );
    }

    if (!termin) {
      errors.push('Kolom Termin (%) harus bernilai 35, 60, atau 5.');
    }

    const invoiceDateIso = parseSheetDateToIso(rawInvoiceDate as string | number) || todayIso;
    const invoiceDateDisplay = formatDateDdMmmYyyy(invoiceDateIso);
    const periodDisplay =
      formatPeriodDisplay(rawPeriod as string | number, invoiceDateIso) ||
      formatPeriodDisplay(invoiceDateIso);

    // Match Vgreen project in Query sheet
    let matchedQueryRow: QueryRow | null = null;
    if (rowIsVgreen) {
      if (rawProjectLoc && rawChargingType) {
        const key = makeProjectKey(rawChargingType, rawProjectLoc);
        matchedQueryRow =
          queryRows.find((q) => makeProjectKey(q.chargingType, q.projectLocation) === key) || null;
      }
      if (!matchedQueryRow && rawWoPo) {
        matchedQueryRow =
          queryRows.find(
            (q) => q.consWoNumber.trim().toLowerCase() === rawWoPo.toLowerCase()
          ) || null;
      }
      if (!matchedQueryRow && rawProjectLoc) {
        matchedQueryRow =
          queryRows.find(
            (q) =>
              normalizeText(q.projectLocation).toLowerCase() === rawProjectLoc.toLowerCase()
          ) || null;
      }

      if (!matchedQueryRow && mode === 'NEW') {
        errors.push(
          `Proyek Vgreen "${rawProjectLoc || rawWoPo || '(kosong)'}" tidak ditemukan pada sheet Query (EPC=CLX dengan Cons WO terisi).`
        );
      }
    }

    const effectiveChargingType = rowIsVgreen
      ? matchedQueryRow?.chargingType || rawChargingType
      : rawChargingType || '-';
    const effectiveProjectLocation = rowIsVgreen
      ? matchedQueryRow?.projectLocation || rawProjectLoc
      : rawProjectLoc || rawItemDesc || effectiveCustomerName;
    const effectiveWoPo = rowIsVgreen
      ? matchedQueryRow?.consWoNumber || rawWoPo
      : rawWoPo || '-';
    const effectiveItemDescription = rowIsVgreen
      ? rawItemDesc || effectiveProjectLocation
      : rawItemDesc;

    if (!rowIsVgreen && !effectiveItemDescription) {
      errors.push('Untuk customer non-Vgreen, kolom Item Description wajib diisi manual.');
    }

    if (unitPrice <= 0) {
      errors.push('Unit Price (IDR) harus lebih dari 0.');
    }

    // Invoice number generation / validation
    let invoiceNumber = '';
    let seqNumber = 0;
    if (mode === 'NEW') {
      const next = generateNextInvoiceNumber(
        simulatedExisting,
        settings.startingSequence,
        invoiceDateIso
      );
      invoiceNumber = next.invoiceNumber;
      seqNumber = next.seqNumber;
    } else {
      invoiceNumber = rawLegacyInvNo;
      if (!invoiceNumber) {
        errors.push('Mode LEGACY wajib mengisi kolom "Invoice No. (Legacy Only)".');
      } else {
        seqNumber = extractSequenceNumber(invoiceNumber);
      }
    }

    const lineItem = {
      id: `bulk-item-${sourceRowNumber}-1`,
      description: effectiveItemDescription,
      qty,
      uom,
      unitPrice,
      amount: Math.round(qty * unitPrice),
    };

    const chosenTermin: TerminPercent = termin || 35;
    const amounts = calculateInvoiceAmounts([lineItem], chosenTermin, taxRate);

    if (errors.length === 0) {
      const validationErr = validateInvoiceForm({
        mode,
        invoiceNumber,
        chargingType: effectiveChargingType,
        projectLocation: effectiveProjectLocation,
        consWoNumber: effectiveWoPo,
        termin: chosenTermin,
        items: [lineItem],
        existingInvoices: simulatedExisting,
        billToName: effectiveCustomerName,
        isVgreen: rowIsVgreen,
      });
      if (validationErr) {
        errors.push(validationErr);
      }
    }

    const paymentStatus: PaymentStatus =
      mode === 'LEGACY' && (rawPayStatus === 'PAID' || rawPayStatus === 'LUNAS')
        ? 'PAID'
        : 'UNPAID';
    const paidDateIso =
      paymentStatus === 'PAID'
        ? parseSheetDateToIso(rawPaidDate as string | number) || invoiceDateIso
        : '';

    if (errors.length === 0) {
      const record: InvoiceRecord = {
        id: `inv-bulk-${Date.now()}-${sourceRowNumber}`,
        invoiceNumber,
        seqNumber,
        mode,
        invoiceDate: invoiceDateIso,
        invoiceDateDisplay,
        period: periodDisplay,
        epcName: 'CLX',
        chargingType: effectiveChargingType,
        projectLocation: effectiveProjectLocation,
        consWoNumber: effectiveWoPo,
        queryDateIso: rowIsVgreen ? matchedQueryRow?.colYDateIso ?? null : null,
        termin: chosenTermin,
        terminLabel: getTerminLabel(chosenTermin),
        contractAmount: amounts.contractAmount,
        terminAmount: amounts.terminAmount,
        taxRate,
        taxAmount: amounts.taxAmount,
        grandTotal: amounts.grandTotal,
        amountInWords: amounts.amountInWords,
        noEfaktur,
        billToName: effectiveCustomerName,
        billToAddress: effectiveAddress,
        items: [lineItem],
        paymentStatus,
        paidDate: paidDateIso,
        paymentRef: paymentStatus === 'PAID' ? paymentRef : '',
        paymentNote: mode === 'LEGACY' ? 'Bulk Legacy Import' : 'Bulk Import',
        retentionDueIso: rowIsVgreen ? matchedQueryRow?.retentionDueIso ?? null : null,
        signatoryName: settings.signatoryName,
        signatoryTitle: settings.signatoryTitle,
        signatoryCity: settings.signatoryCity,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      simulatedExisting.push(record);
      validInvoices.push(record);

      if (isNewCustomer && effectiveAddress && !newCustomersMap.has(custKey)) {
        newCustomersMap.set(custKey, {
          name: effectiveCustomerName,
          address: effectiveAddress,
        });
      }

      previewRows.push({
        sourceRowNumber,
        isValid: true,
        errors: [],
        customerName: effectiveCustomerName,
        isNewCustomer,
        customerAddress: effectiveAddress,
        invoice: record,
      });
    } else {
      previewRows.push({
        sourceRowNumber,
        isValid: false,
        errors,
        customerName: effectiveCustomerName,
        isNewCustomer,
        customerAddress: effectiveAddress,
        invoice: null,
      });
    }
  }

  return {
    rows: previewRows,
    validInvoices,
    newCustomersToCreate: Array.from(newCustomersMap.values()),
    validCount: validInvoices.length,
    errorCount: previewRows.length - validInvoices.length,
  };
}

/**
 * Filters invoices and Vgreen Query rows for Summary Dashboard customer selector.
 * When selectedCustomer === 'ALL', returns all invoices and all Vgreen query rows.
 */
export function filterDashboardByCustomer(
  invoices: InvoiceRecord[],
  queryRows: QueryRow[],
  selectedCustomer: string
): {
  filteredInvoices: InvoiceRecord[];
  filteredQueryRows: QueryRow[];
  isAllSelected: boolean;
  isVgreenSelected: boolean;
} {
  if (!selectedCustomer || selectedCustomer === 'ALL') {
    return {
      filteredInvoices: invoices,
      filteredQueryRows: queryRows,
      isAllSelected: true,
      isVgreenSelected: true,
    };
  }

  const targetKey = normalizeText(selectedCustomer).toLowerCase();
  const isVgreenSelected = isVgreenCustomer(selectedCustomer);
  const filteredInvoices = invoices.filter(
    (inv) => normalizeText(inv.billToName || DEFAULT_VGREEN_CUSTOMER.name).toLowerCase() === targetKey
  );

  return {
    filteredInvoices,
    filteredQueryRows: isVgreenSelected ? queryRows : [],
    isAllSelected: false,
    isVgreenSelected,
  };
}

/**
 * Downloads a ready-to-use Excel (.xlsx) template with realistic examples and a Panduan sheet.
 */
export function downloadBulkExcelTemplate(mode: InvoiceMode, todayIso?: string): void {
  const iso = todayIso || new Date().toISOString().slice(0, 10);
  const period = formatPeriodDisplay(iso);
  const isLegacy = mode === 'LEGACY';

  const sampleRows: Array<(string | number)[]> = [
    [...BULK_TEMPLATE_HEADERS],
    [
      DEFAULT_VGREEN_CUSTOMER.name,
      DEFAULT_VGREEN_CUSTOMER.address,
      'KF 0042 Semarang Tengah',
      'BSS 6 Slot 1 Phase',
      'VGID-WO/BD/2026/IX/1142',
      35,
      iso,
      period,
      'KF 0042 Semarang Tengah',
      1,
      'Unit',
      8500000,
      11,
      '',
      isLegacy ? '841/INV/CLX/IX/2026' : '',
      isLegacy ? 'PAID' : '',
      isLegacy ? iso : '',
      isLegacy ? 'BCA-TRF/20260925/001' : '',
    ],
    [
      'PT Nusantara Energi Infrastruktur',
      'Menara Karya Lt. 12, Jl. H.R. Rasuna Said Blok X-5 Kav. 1-2, Jakarta Selatan 12950',
      'Instalasi Panel Distribusi Cikarang',
      'Electrical Installation',
      'PO/NEI/2026/XI/008',
      35,
      iso,
      period,
      'Instalasi Panel Distribusi & Pengujian Beban Cikarang',
      1,
      'Lot',
      15000000,
      11,
      '',
      isLegacy ? '842/INV/CLX/IX/2026' : '',
      isLegacy ? 'UNPAID' : '',
      '',
      '',
    ],
  ];

  const guideRows: string[][] = [
    ['Kolom', 'Kewajiban', 'Keterangan & Format'],
    ['Customer Name', 'Wajib', 'Nama perusahaan customer (gunakan nama PT Vgreen untuk proyek dari sheet Query).'],
    ['Customer Address', 'Wajib jika customer baru', 'Alamat lengkap customer. Boleh kosong jika customer sudah terdaftar di sistem.'],
    ['Project / Location Name', 'Wajib (Vgreen)', 'Harus cocok dengan Kolom F pada sheet Query untuk customer Vgreen.'],
    ['Project / Charging Type', 'Wajib (Vgreen)', 'Harus cocok dengan Kolom C pada sheet Query untuk customer Vgreen; bebas/manual untuk non-Vgreen.'],
    ['WO/PO No.', 'Opsional (Non-Vgreen)', 'Otomatis diambil dari Kolom W sheet Query untuk Vgreen; isi nomor PO/WO manual untuk non-Vgreen.'],
    ['Termin (%)', 'Wajib', 'Isi angka: 35, 60, atau 5. Sistem otomatis menjaga aturan anti double-billing Vgreen (35% -> 60% -> 5%).'],
    ['Invoice Date', 'Disarankan', 'Format YYYY-MM-DD (contoh: 2026-11-20). Output PDF otomatis berformat DD-MMM-YYYY.'],
    ['Period', 'Opsional', 'Format MMM-YYYY (contoh: Nov-2026). Jika kosong otomatis diambil dari Invoice Date.'],
    ['Item Description', 'Wajib (Non-Vgreen)', 'Untuk customer selain Vgreen WAJIB diisi manual. Untuk Vgreen boleh kosong (otomatis ikut Project / Location).'],
    ['Qty', 'Wajib', 'Jumlah unit/lot (default 1).'],
    ['UOM', 'Opsional', 'Satuan seperti Unit, Lot, Set, Paket (default Unit).'],
    ['Unit Price (IDR)', 'Wajib', 'Harga kontrak 100% per unit dalam Rupiah (angka tanpa koma desimal, contoh: 8500000).'],
    ['Tax Rate (%)', 'Opsional', 'Tarif PPN dalam persen (default 11).'],
    ['No. Efaktur', 'Opsional', 'Nomor seri faktur pajak jika sudah tersedia.'],
    ['Invoice No. (Legacy Only)', 'Wajib (LEGACY)', 'Kosongkan untuk mode NEW (auto-numbering berlanjut lintas customer). Wajib diisi untuk mode LEGACY.'],
    ['Payment Status (Legacy Only)', 'Opsional (LEGACY)', 'Isi PAID atau UNPAID (khusus migrasi invoice lama).'],
    ['Paid Date (Legacy Only)', 'Opsional (LEGACY)', 'Tanggal lunas (YYYY-MM-DD) jika Payment Status = PAID.'],
    ['Payment Ref (Legacy Only)', 'Opsional (LEGACY)', 'Nomor referensi mutasi/transfer BCA jika sudah PAID.'],
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.aoa_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 38 },
    { wch: 42 },
    { wch: 28 },
    { wch: 24 },
    { wch: 26 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Template_Bulk_Invoice');

  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 85 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Kolom');

  XLSX.writeFile(wb, `Template_Bulk_Invoice_${mode}_CLX.xlsx`);
}

/**
 * Parses an uploaded Excel (.xlsx / .xls) or CSV file into a raw 2D array from the first worksheet.
 */
export async function parseExcelFileToGrid(file: File): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel tidak memiliki worksheet.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  return rows;
}
