import type {
  AppSettings,
  InvoiceLineItem,
  InvoiceMode,
  InvoiceRecord,
  ProjectTerminSummary,
  QueryRow,
  ReminderUrgency,
  RetentionReminder,
  TerminPercent,
} from '../types/invoice';

export const DEFAULT_SPREADSHEET_ID = '1DAMUTOSwLDKXHaSZFTgInITDWtlBL6oRbnmp6xPIH1o';

export const DEFAULT_SETTINGS: AppSettings = {
  spreadsheetId: DEFAULT_SPREADSHEET_ID,
  querySheetName: 'Query',
  invoicesSheetName: 'Invoices_DB',
  startingSequence: 850,
  defaultTaxRate: 11,
  defaultBillToName: 'PT Vgreen Global Charging Station Investment Indonesia',
  defaultBillToAddress:
    'Graha Binakarsa Lt.7 Jl. H.R Rasuna Said Kav C-18 RT 02 RW 005, Karet Kuningan, Kec. Setiabudi Jakarta Selatan',
  signatoryName: 'Christian',
  signatoryTitle: 'President Director',
  signatoryCity: 'Jakarta',
};

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function makeProjectKey(chargingType: string, projectLocation: string): string {
  return `${normalizeText(chargingType).toLowerCase()}||${normalizeText(projectLocation).toLowerCase()}`;
}

export function getTerminLabel(termin: TerminPercent): string {
  if (termin === 35) return 'TERMIN 1 (35%)';
  if (termin === 60) return 'TERMIN 2 (60%)';
  return 'TERMIN 3 (5%)';
}

export function toRomanMonth(month1To12: number): string {
  const idx = Math.max(0, Math.min(11, month1To12 - 1));
  return ROMAN_MONTHS[idx];
}

export function formatMonthYear(dateIso: string): string {
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || month < 1 || month > 12) return dateIso;
  return `${ENGLISH_MONTHS[month - 1]} ${year}`;
}

export function formatFullDateDisplay(dateIso: string): string {
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return dateIso;
  return `${day} ${ENGLISH_MONTHS[month - 1]} ${year}`;
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-${absFormatted}` : absFormatted;
}

export function formatRupiahWithPrefix(amount: number): string {
  return `Rp ${formatRupiah(amount)}`;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  januari: 1,
  feb: 2,
  february: 2,
  februari: 2,
  mar: 3,
  march: 3,
  maret: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  june: 6,
  juni: 6,
  jul: 7,
  july: 7,
  juli: 7,
  aug: 8,
  august: 8,
  agu: 8,
  agustus: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  nop: 11,
  nopember: 11,
  dec: 12,
  december: 12,
  des: 12,
  desember: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function buildIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Parses common Google Sheets date strings or serial numbers into YYYY-MM-DD.
 */
export function parseSheetDateToIso(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // 1. Google Sheets numeric serial date (e.g. 45978)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = Math.floor(Number(str));
    if (serial > 20000 && serial < 90000) {
      const baseMs = Date.UTC(1899, 11, 30);
      const dt = new Date(baseMs + serial * 86400000);
      return buildIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }

  // 2. ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return buildIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY (with fallback if MM/DD/YYYY where second > 12)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const p1 = Number(dmyMatch[1]);
    const p2 = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (p2 > 12 && p1 <= 12) {
      return buildIso(year, p1, p2);
    }
    return buildIso(year, p2, p1);
  }

  // 4. "17 Nov 2025", "17-Nov-2025", "17 November 2025"
  const dMonY = str.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s,-]+(\d{4})$/);
  if (dMonY) {
    const day = Number(dMonY[1]);
    const monKey = dMonY[2].toLowerCase();
    const year = Number(dMonY[3]);
    const month = MONTH_NAME_MAP[monKey];
    if (month) return buildIso(year, month, day);
  }

  // 5. "Nov 17, 2025" or "November 17 2025"
  const monDY = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monDY) {
    const monKey = monDY[1].toLowerCase();
    const day = Number(monDY[2]);
    const year = Number(monDY[3]);
    const month = MONTH_NAME_MAP[monKey];
    if (month) return buildIso(year, month, day);
  }

  return null;
}

export function addOneYearIso(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const parts = dateIso.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]) + 1;
  const month = Number(parts[1]);
  let day = Number(parts[2]);
  // Clamp Feb 29 on leap year -> Feb 28 on non-leap year
  if (month === 2 && day === 29) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (!isLeap) day = 28;
  }
  return buildIso(year, month, day);
}

export function diffDaysIso(targetIso: string, referenceIso: string): number {
  const [ty, tm, td] = targetIso.split('-').map(Number);
  const [ry, rm, rd] = referenceIso.split('-').map(Number);
  const targetMs = Date.UTC(ty, tm - 1, td);
  const refMs = Date.UTC(ry, rm - 1, rd);
  return Math.round((targetMs - refMs) / 86400000);
}

/**
 * Parses rows from Google Sheet "Query":
 * - Col B (index 1): EPC Name === "CLX"
 * - Col C (index 2): Charging Type
 * - Col F (index 5): Project / Location Name
 * - Col W (index 22): Cons WO number (must be non-empty)
 * - Col Y (index 24): Date used for +1 year Termin 5% reminder
 */
export function parseQueryRows(values: string[][]): QueryRow[] {
  if (!values || values.length === 0) return [];

  const firstRowJoined = (values[0] || []).join(' ').toLowerCase();
  const hasHeader =
    firstRowJoined.includes('epc') ||
    firstRowJoined.includes('charging') ||
    firstRowJoined.includes('project') ||
    firstRowJoined.includes('location') ||
    firstRowJoined.includes('wo');

  const startIdx = hasHeader ? 1 : 0;
  const results: QueryRow[] = [];

  for (let i = startIdx; i < values.length; i++) {
    const row = values[i] || [];
    const epcName = normalizeText(row[1] ?? '');
    const chargingType = normalizeText(row[2] ?? '');
    const projectLocation = normalizeText(row[5] ?? '');
    const consWoNumber = normalizeText(row[22] ?? '');
    const colYDateRaw = (row[24] ?? '').toString().trim();

    if (epcName.toUpperCase() !== 'CLX') continue;
    if (!consWoNumber) continue;
    if (!chargingType && !projectLocation) continue;

    const colYDateIso = parseSheetDateToIso(colYDateRaw);
    const retentionDueIso = addOneYearIso(colYDateIso);

    results.push({
      rowIndex: i + 1, // 1-based sheet row index
      epcName: 'CLX',
      chargingType,
      projectLocation,
      consWoNumber,
      colYDateRaw,
      colYDateIso,
      retentionDueIso,
    });
  }

  return results;
}

export function extractSequenceNumber(invoiceNumber: string): number {
  const match = invoiceNumber.trim().match(/^(\d+)\//);
  if (!match) return 0;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : 0;
}

export function generateNextInvoiceNumber(
  existingInvoices: Pick<InvoiceRecord, 'invoiceNumber' | 'seqNumber'>[],
  startingSequence: number,
  invoiceDateIso: string
): { invoiceNumber: string; seqNumber: number } {
  const existingNumbers = new Set(
    existingInvoices.map((inv) => inv.invoiceNumber.trim().toUpperCase())
  );

  let maxSeq = Math.max(0, startingSequence - 1);
  for (const inv of existingInvoices) {
    const seq = inv.seqNumber > 0 ? inv.seqNumber : extractSequenceNumber(inv.invoiceNumber);
    if (seq > maxSeq) maxSeq = seq;
  }

  const parts = invoiceDateIso.split('-');
  const year = parts[0] || String(new Date().getFullYear());
  const month = Number(parts[1]) || new Date().getMonth() + 1;
  const romanMonth = toRomanMonth(month);

  let candidateSeq = maxSeq + 1;
  let candidateNumber = `${candidateSeq}/INV/CLX/${romanMonth}/${year}`;
  while (existingNumbers.has(candidateNumber.toUpperCase())) {
    candidateSeq += 1;
    candidateNumber = `${candidateSeq}/INV/CLX/${romanMonth}/${year}`;
  }

  return {
    invoiceNumber: candidateNumber,
    seqNumber: candidateSeq,
  };
}

export interface TerminAvailability {
  hasTermin35: boolean;
  hasTermin60: boolean;
  hasTermin5: boolean;
  allowedTermins: TerminPercent[];
  recommendedTermin: TerminPercent | null;
  lockedReasons: Record<TerminPercent, string | null>;
}

export function getTerminAvailability(
  chargingType: string,
  projectLocation: string,
  invoices: InvoiceRecord[],
  mode: InvoiceMode,
  editingInvoiceId?: string
): TerminAvailability {
  const key = makeProjectKey(chargingType, projectLocation);
  const matching = invoices.filter(
    (inv) =>
      inv.id !== editingInvoiceId &&
      makeProjectKey(inv.chargingType, inv.projectLocation) === key
  );

  const hasTermin35 = matching.some((inv) => inv.termin === 35);
  const hasTermin60 = matching.some((inv) => inv.termin === 60);
  const hasTermin5 = matching.some((inv) => inv.termin === 5);

  const lockedReasons: Record<TerminPercent, string | null> = {
    35: null,
    60: null,
    5: null,
  };

  if (mode === 'LEGACY') {
    if (hasTermin35) lockedReasons[35] = 'Termin 35% sudah tercatat untuk lokasi & charging type ini.';
    if (hasTermin60) lockedReasons[60] = 'Termin 60% sudah tercatat untuk lokasi & charging type ini.';
    if (hasTermin5) lockedReasons[5] = 'Termin 5% sudah tercatat untuk lokasi & charging type ini.';

    const allowedTermins: TerminPercent[] = ([35, 60, 5] as TerminPercent[]).filter(
      (t) => !lockedReasons[t]
    );
    return {
      hasTermin35,
      hasTermin60,
      hasTermin5,
      allowedTermins,
      recommendedTermin: allowedTermins[0] ?? null,
      lockedReasons,
    };
  }

  // Strict sequential progression for NEW invoices
  if (!hasTermin35) {
    lockedReasons[60] = 'Harus membuat Termin 1 (35%) terlebih dahulu.';
    lockedReasons[5] = 'Harus menyelesaikan Termin 35% dan 60% terlebih dahulu.';
    return {
      hasTermin35,
      hasTermin60,
      hasTermin5,
      allowedTermins: [35],
      recommendedTermin: 35,
      lockedReasons,
    };
  }

  if (!hasTermin60) {
    lockedReasons[35] = 'Termin 1 (35%) sudah ditagih — hanya Termin 2 (60%) yang diperbolehkan.';
    lockedReasons[5] = 'Harus membuat Termin 2 (60%) terlebih dahulu.';
    return {
      hasTermin35,
      hasTermin60,
      hasTermin5,
      allowedTermins: [60],
      recommendedTermin: 60,
      lockedReasons,
    };
  }

  if (!hasTermin5) {
    lockedReasons[35] = 'Termin 1 (35%) sudah ditagih.';
    lockedReasons[60] = 'Termin 2 (60%) sudah ditagih.';
    return {
      hasTermin35,
      hasTermin60,
      hasTermin5,
      allowedTermins: [5],
      recommendedTermin: 5,
      lockedReasons,
    };
  }

  lockedReasons[35] = 'Semua termin (35%, 60%, 5%) sudah lunas ditagih.';
  lockedReasons[60] = 'Semua termin (35%, 60%, 5%) sudah lunas ditagih.';
  lockedReasons[5] = 'Semua termin (35%, 60%, 5%) sudah lunas ditagih.';
  return {
    hasTermin35,
    hasTermin60,
    hasTermin5,
    allowedTermins: [],
    recommendedTermin: null,
    lockedReasons,
  };
}

export function validateInvoiceForm(params: {
  mode: InvoiceMode;
  invoiceNumber: string;
  chargingType: string;
  projectLocation: string;
  consWoNumber: string;
  termin: TerminPercent;
  items: InvoiceLineItem[];
  existingInvoices: InvoiceRecord[];
  editingInvoiceId?: string;
}): string | null {
  const {
    mode,
    invoiceNumber,
    chargingType,
    projectLocation,
    consWoNumber,
    termin,
    items,
    existingInvoices,
    editingInvoiceId,
  } = params;

  if (!chargingType.trim() || !projectLocation.trim()) {
    return 'Charging Type dan Project / Location Name wajib dipilih.';
  }

  if (!consWoNumber.trim()) {
    return 'Cons WO number (Kolom W) tidak boleh kosong.';
  }

  if (!invoiceNumber.trim()) {
    return 'Nomor Invoice wajib diisi.';
  }

  const normalizedInvNo = invoiceNumber.trim().toUpperCase();
  const duplicateNumber = existingInvoices.some(
    (inv) => inv.id !== editingInvoiceId && inv.invoiceNumber.trim().toUpperCase() === normalizedInvNo
  );
  if (duplicateNumber) {
    return `Nomor invoice "${invoiceNumber}" sudah ada di sistem. Gunakan nomor lain agar tidak terjadi duplikasi.`;
  }

  const availability = getTerminAvailability(
    chargingType,
    projectLocation,
    existingInvoices,
    mode,
    editingInvoiceId
  );

  if (!availability.allowedTermins.includes(termin)) {
    return (
      availability.lockedReasons[termin] ||
      `Termin ${termin}% tidak dapat dibuat untuk kombinasi Charging Type & Project ini.`
    );
  }

  if (items.length === 0 || items.every((item) => item.qty <= 0 || item.unitPrice <= 0)) {
    return 'Minimal satu item dengan Qty dan Unit Price lebih dari 0 wajib diisi.';
  }

  return null;
}

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function convertHundreds(num: number): string {
  const parts: string[] = [];
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundred > 0) {
    parts.push(`${ONES[hundred]} hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder]);
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      parts.push(one > 0 ? `${TENS[ten]}-${ONES[one]}` : TENS[ten]);
    }
  }

  return parts.join(' ');
}

/**
 * Converts integer amount into readable English invoice words matching PT. CLX format:
 * e.g. 5661000 -> "Five million, six hundred sixty-one thousand"
 */
export function numberToWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'Zero';

  const groups: number[] = [];
  let temp = n;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const wordGroups: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp === 0) continue;
    const chunk = convertHundreds(grp);
    const scale = SCALES[i];
    wordGroups.push(scale ? `${chunk} ${scale}` : chunk);
  }

  const joined = wordGroups.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export function calculateInvoiceAmounts(
  items: InvoiceLineItem[],
  termin: TerminPercent,
  taxRate: number
): {
  contractAmount: number;
  terminAmount: number;
  taxAmount: number;
  grandTotal: number;
  amountInWords: string;
} {
  const contractAmount = Math.round(
    items.reduce((sum, item) => sum + Math.round(item.qty * item.unitPrice), 0)
  );
  const terminAmount = Math.round(contractAmount * (termin / 100));
  const taxAmount = Math.round(terminAmount * (taxRate / 100));
  const grandTotal = terminAmount + taxAmount;
  const amountInWords = numberToWords(grandTotal);

  return {
    contractAmount,
    terminAmount,
    taxAmount,
    grandTotal,
    amountInWords,
  };
}

export function buildProjectTerminSummaries(
  queryRows: QueryRow[],
  invoices: InvoiceRecord[]
): ProjectTerminSummary[] {
  const invoiceMap = new Map<string, InvoiceRecord[]>();
  for (const inv of invoices) {
    const key = makeProjectKey(inv.chargingType, inv.projectLocation);
    const list = invoiceMap.get(key) || [];
    list.push(inv);
    invoiceMap.set(key, list);
  }

  const seenKeys = new Set<string>();
  const summaries: ProjectTerminSummary[] = [];

  for (const row of queryRows) {
    const key = makeProjectKey(row.chargingType, row.projectLocation);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const projectInvoices = invoiceMap.get(key) || [];
    const termin35 = projectInvoices.find((i) => i.termin === 35) || null;
    const termin60 = projectInvoices.find((i) => i.termin === 60) || null;
    const termin5 = projectInvoices.find((i) => i.termin === 5) || null;

    let nextAllowedTermin: TerminPercent | null = null;
    if (!termin35) nextAllowedTermin = 35;
    else if (!termin60) nextAllowedTermin = 60;
    else if (!termin5) nextAllowedTermin = 5;

    const completionPercent =
      (termin35 ? 35 : 0) + (termin60 ? 60 : 0) + (termin5 ? 5 : 0);

    summaries.push({
      projectKey: key,
      chargingType: row.chargingType,
      projectLocation: row.projectLocation,
      consWoNumber: row.consWoNumber,
      colYDateIso: row.colYDateIso,
      retentionDueIso: row.retentionDueIso,
      termin35,
      termin60,
      termin5,
      nextAllowedTermin,
      completionPercent,
    });
  }

  return summaries;
}

export function buildRetentionReminders(
  queryRows: QueryRow[],
  invoices: InvoiceRecord[],
  referenceDateIso: string
): RetentionReminder[] {
  const summaries = buildProjectTerminSummaries(queryRows, invoices);

  const reminders: RetentionReminder[] = summaries.map((proj) => {
    const hasTermin35 = Boolean(proj.termin35);
    const hasTermin60 = Boolean(proj.termin60);
    const hasTermin5 = Boolean(proj.termin5);
    const matchingRow = queryRows.find(
      (r) => makeProjectKey(r.chargingType, r.projectLocation) === proj.projectKey
    );

    let daysRemaining: number | null = null;
    let urgency: ReminderUrgency = 'NO_DATE';

    if (hasTermin5) {
      urgency = 'COMPLETED';
      daysRemaining = proj.retentionDueIso
        ? diffDaysIso(proj.retentionDueIso, referenceDateIso)
        : null;
    } else if (proj.retentionDueIso) {
      daysRemaining = diffDaysIso(proj.retentionDueIso, referenceDateIso);
      if (daysRemaining <= 0) urgency = 'OVERDUE';
      else if (daysRemaining <= 30) urgency = 'DUE_SOON';
      else if (daysRemaining <= 90) urgency = 'UPCOMING';
      else urgency = 'SCHEDULED';
    }

    return {
      projectKey: proj.projectKey,
      chargingType: proj.chargingType,
      projectLocation: proj.projectLocation,
      consWoNumber: proj.consWoNumber,
      colYDateIso: proj.colYDateIso,
      colYDateRaw: matchingRow?.colYDateRaw || '',
      dueDateIso: proj.retentionDueIso,
      daysRemaining,
      urgency,
      hasTermin35,
      hasTermin60,
      hasTermin5,
      canCreateTermin5Directly: hasTermin35 && hasTermin60 && !hasTermin5,
    };
  });

  const order: Record<ReminderUrgency, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    UPCOMING: 2,
    SCHEDULED: 3,
    NO_DATE: 4,
    COMPLETED: 5,
  };

  return reminders.sort((a, b) => {
    const rankDiff = order[a.urgency] - order[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    if (a.daysRemaining !== null && b.daysRemaining !== null) {
      return a.daysRemaining - b.daysRemaining;
    }
    return a.projectLocation.localeCompare(b.projectLocation);
  });
}

export interface DashboardMetrics {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
  eligibleProjectsCount: number;
  fullyCompletedProjects: number;
  urgentRemindersCount: number;
  terminBreakdown: {
    termin35Amount: number;
    termin35Count: number;
    termin60Amount: number;
    termin60Count: number;
    termin5Amount: number;
    termin5Count: number;
  };
  monthlyTrend: Array<{
    monthKey: string;
    label: string;
    invoiced: number;
    collected: number;
  }>;
}

export function buildDashboardMetrics(
  queryRows: QueryRow[],
  invoices: InvoiceRecord[],
  referenceDateIso: string
): DashboardMetrics {
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  let termin35Amount = 0;
  let termin35Count = 0;
  let termin60Amount = 0;
  let termin60Count = 0;
  let termin5Amount = 0;
  let termin5Count = 0;

  const monthlyMap = new Map<string, { invoiced: number; collected: number }>();

  for (const inv of invoices) {
    totalInvoiced += inv.grandTotal;
    if (inv.paymentStatus === 'PAID') {
      totalCollected += inv.grandTotal;
      paidCount += 1;
    } else {
      totalOutstanding += inv.grandTotal;
      unpaidCount += 1;
    }

    if (inv.termin === 35) {
      termin35Amount += inv.grandTotal;
      termin35Count += 1;
    } else if (inv.termin === 60) {
      termin60Amount += inv.grandTotal;
      termin60Count += 1;
    } else {
      termin5Amount += inv.grandTotal;
      termin5Count += 1;
    }

    const monthKey = inv.invoiceDate.slice(0, 7); // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(monthKey)) {
      const curr = monthlyMap.get(monthKey) || { invoiced: 0, collected: 0 };
      curr.invoiced += inv.grandTotal;
      if (inv.paymentStatus === 'PAID') {
        curr.collected += inv.grandTotal;
      }
      monthlyMap.set(monthKey, curr);
    }
  }

  const summaries = buildProjectTerminSummaries(queryRows, invoices);
  const reminders = buildRetentionReminders(queryRows, invoices, referenceDateIso);

  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, val]) => {
      const [y, m] = monthKey.split('-').map(Number);
      const shortMonth = ENGLISH_MONTHS[(m || 1) - 1].slice(0, 3);
      return {
        monthKey,
        label: `${shortMonth} '${String(y).slice(-2)}`,
        invoiced: val.invoiced,
        collected: val.collected,
      };
    });

  return {
    totalInvoiced,
    totalCollected,
    totalOutstanding,
    collectionRate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
    invoiceCount: invoices.length,
    paidCount,
    unpaidCount,
    eligibleProjectsCount: summaries.length,
    fullyCompletedProjects: summaries.filter((s) => s.completionPercent === 100).length,
    urgentRemindersCount: reminders.filter(
      (r) => r.urgency === 'OVERDUE' || r.urgency === 'DUE_SOON'
    ).length,
    terminBreakdown: {
      termin35Amount,
      termin35Count,
      termin60Amount,
      termin60Count,
      termin5Amount,
      termin5Count,
    },
    monthlyTrend,
  };
}

export function formatAuthErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const combined = `${code} ${raw}`.toLowerCase();

  if (combined.includes('unauthorized-domain')) {
    return 'Domain aplikasi ini belum didaftarkan di Firebase Authentication > Settings > Authorized domains. Tambahkan domain Vercel Anda ke daftar tersebut lalu coba login lagi.';
  }
  if (combined.includes('access_denied') || combined.includes('verification process')) {
    return 'Akses Google diblokir (Error 403 access_denied): OAuth Consent Screen masih berstatus Testing. Tambahkan email user finance di Google Cloud Console > APIs & Services > OAuth consent screen > Test users (atau Publish App), dan pastikan email tersebut diberi akses Editor pada Google Sheet.';
  }
  if (combined.includes('popup-closed-by-user')) {
    return 'Popup login Google ditutup sebelum proses selesai. Jika terblokir di layar Google, pastikan email sudah terdaftar di Test users (OAuth consent screen).';
  }
  if (combined.includes('popup-blocked')) {
    return 'Popup login diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba Sign in with Google kembali.';
  }

  return raw || 'Login Google dibatalkan atau gagal.';
}

