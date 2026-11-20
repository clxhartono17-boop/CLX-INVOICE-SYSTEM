export type TerminPercent = 35 | 60 | 5;

export type InvoiceMode = 'NEW' | 'LEGACY';

export type PaymentStatus = 'UNPAID' | 'PAID';

export interface QueryRow {
  rowIndex: number; // 1-based row index in Google Sheet "Query"
  epcName: string; // Col B (only "CLX")
  chargingType: string; // Col C
  projectLocation: string; // Col F
  consWoNumber: string; // Col W (non-empty required)
  colYDateRaw: string; // Col Y raw value
  colYDateIso: string | null; // Parsed YYYY-MM-DD
  retentionDueIso: string | null; // Col Y + 1 year YYYY-MM-DD
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  amount: number;
}

export interface InvoiceRecord {
  id: string;
  rowIndex?: number; // 1-based row index in "Invoices_DB" sheet
  invoiceNumber: string; // e.g. 849/INV/CLX/XI/2026
  seqNumber: number; // e.g. 849
  mode: InvoiceMode;
  invoiceDate: string; // YYYY-MM-DD
  invoiceDateDisplay: string; // e.g. "November 2026" or "17 November 2026"
  period: string; // e.g. "November 2026"
  epcName: string; // "CLX"
  chargingType: string; // From Query Col C
  projectLocation: string; // From Query Col F
  consWoNumber: string; // From Query Col W
  queryDateIso: string | null; // From Query Col Y
  termin: TerminPercent;
  terminLabel: string; // e.g. "TERMIN 1 (35%)", "TERMIN 2 (60%)", "TERMIN 3 (5%)"
  contractAmount: number; // Base 100% subtotal
  terminAmount: number; // contractAmount * (termin / 100)
  taxRate: number; // Default 11 (%)
  taxAmount: number; // Math.round(terminAmount * (taxRate / 100))
  grandTotal: number; // terminAmount + taxAmount
  amountInWords: string;
  noEfaktur: string;
  billToName: string;
  billToAddress: string;
  items: InvoiceLineItem[];
  paymentStatus: PaymentStatus;
  paidDate: string;
  paymentRef: string;
  paymentNote: string;
  retentionDueIso: string | null;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCity: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderUrgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'SCHEDULED' | 'COMPLETED' | 'NO_DATE';

export interface RetentionReminder {
  projectKey: string;
  chargingType: string;
  projectLocation: string;
  consWoNumber: string;
  colYDateIso: string | null;
  colYDateRaw: string;
  dueDateIso: string | null;
  daysRemaining: number | null;
  urgency: ReminderUrgency;
  hasTermin35: boolean;
  hasTermin60: boolean;
  hasTermin5: boolean;
  canCreateTermin5Directly: boolean;
}

export interface ProjectTerminSummary {
  projectKey: string;
  chargingType: string;
  projectLocation: string;
  consWoNumber: string;
  colYDateIso: string | null;
  retentionDueIso: string | null;
  termin35: InvoiceRecord | null;
  termin60: InvoiceRecord | null;
  termin5: InvoiceRecord | null;
  nextAllowedTermin: TerminPercent | null;
  completionPercent: number;
}

export interface CustomerRecord {
  id: string;
  name: string;
  address: string;
  isVgreen?: boolean;
  createdAt?: string;
}

export interface AppSettings {
  spreadsheetId: string;
  querySheetName: string;
  invoicesSheetName: string;
  customersSheetName?: string;
  startingSequence: number;
  defaultTaxRate: number;
  defaultBillToName: string;
  defaultBillToAddress: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryCity: string;
}

export type ActiveTab = 'dashboard' | 'invoices' | 'projects' | 'reminders';
