import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BULK_TEMPLATE_HEADERS,
  filterDashboardByCustomer,
  parseBulkInvoiceRows,
  parseLooseNumber,
} from './bulkInvoiceLogic';
import { DEFAULT_SETTINGS, DEFAULT_VGREEN_CUSTOMER } from './invoiceLogic';
import type { InvoiceRecord, QueryRow } from '../types/invoice';

const sampleQueryRows: QueryRow[] = [
  {
    rowIndex: 2,
    epcName: 'CLX',
    chargingType: 'BSS 6 Slot 1 Phase',
    projectLocation: 'KF 0042 Semarang Tengah',
    consWoNumber: 'VGID-WO/BD/2026/IX/1142',
    colYDateRaw: '2025-12-05',
    colYDateIso: '2025-12-05',
    retentionDueIso: '2026-12-05',
  },
];

function makeBaseInvoice(overrides: Partial<InvoiceRecord>): InvoiceRecord {
  return {
    id: 'inv-849',
    invoiceNumber: '849/INV/CLX/XI/2026',
    seqNumber: 849,
    mode: 'NEW',
    invoiceDate: '2026-11-10',
    invoiceDateDisplay: '10-Nov-2026',
    period: 'Nov-2026',
    epcName: 'CLX',
    chargingType: 'BSS 6 Slot 1 Phase',
    projectLocation: 'KF 0016 Pekalongan',
    consWoNumber: 'VGID-WO/BD/2026/VIII/1098',
    queryDateIso: '2025-11-10',
    termin: 35,
    terminLabel: 'TERMIN 1 (35%)',
    contractAmount: 8500000,
    terminAmount: 2975000,
    taxRate: 11,
    taxAmount: 327250,
    grandTotal: 3302250,
    amountInWords: 'Three million, three hundred two thousand, two hundred fifty',
    noEfaktur: '',
    billToName: DEFAULT_VGREEN_CUSTOMER.name,
    billToAddress: DEFAULT_VGREEN_CUSTOMER.address,
    items: [
      {
        id: '1',
        description: 'KF 0016 Pekalongan',
        qty: 1,
        uom: 'Unit',
        unitPrice: 8500000,
        amount: 8500000,
      },
    ],
    paymentStatus: 'UNPAID',
    paidDate: '',
    paymentRef: '',
    paymentNote: '',
    retentionDueIso: '2026-11-10',
    signatoryName: 'Christian',
    signatoryTitle: 'President Director',
    signatoryCity: 'Jakarta',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

test('parseLooseNumber parses Indonesian currency strings, commas, and raw numbers', () => {
  assert.equal(parseLooseNumber(8500000), 8500000);
  assert.equal(parseLooseNumber('8.500.000'), 8500000);
  assert.equal(parseLooseNumber('Rp 12.500.000'), 12500000);
  assert.equal(parseLooseNumber('15,000,000'), 15000000);
});

test('parseBulkInvoiceRows (NEW mode) assigns continuous invoice numbers across Vgreen and new Non-Vgreen customers and prevents in-batch double-billing', () => {
  const existing = [makeBaseInvoice({ seqNumber: 849, invoiceNumber: '849/INV/CLX/XI/2026' })];

  const rows: unknown[][] = [
    [...BULK_TEMPLATE_HEADERS],
    // Row 2: Valid Vgreen 35% (serial date 46054 -> 01-Feb-2026 / Feb-2026)
    [
      DEFAULT_VGREEN_CUSTOMER.name,
      '',
      'KF 0042 Semarang Tengah',
      'BSS 6 Slot 1 Phase',
      '',
      35,
      46054,
      46054,
      '',
      1,
      'Unit',
      '8.500.000',
      11,
      '',
      '',
      '',
      '',
      '',
    ],
    // Row 3: Duplicate Vgreen 35% in same batch -> MUST fail anti double-billing!
    [
      DEFAULT_VGREEN_CUSTOMER.name,
      '',
      'KF 0042 Semarang Tengah',
      'BSS 6 Slot 1 Phase',
      '',
      35,
      '2026-11-20',
      'Nov-2026',
      '',
      1,
      'Unit',
      8500000,
      11,
      '',
      '',
      '',
      '',
      '',
    ],
    // Row 4: Valid New Non-Vgreen customer with manual Item Description -> gets continuous 851
    [
      'PT Sinar Energi Mandiri',
      'Jl. Sudirman Kav 52, Jakarta Selatan',
      'Panel MDP Cikarang',
      'Electrical Maintenance',
      'PO/SEM/2026/001',
      35,
      '2026-11-20',
      '',
      'Instalasi Panel MDP Cikarang',
      1,
      'Lot',
      10000000,
      11,
      '',
      '',
      '',
      '',
      '',
    ],
    // Row 5: Non-Vgreen missing manual Item Description -> MUST fail
    [
      'PT Sinar Energi Mandiri',
      'Jl. Sudirman Kav 52, Jakarta Selatan',
      '',
      'Maintenance',
      'PO/SEM/2026/002',
      35,
      '2026-11-20',
      '',
      '   ',
      1,
      'Lot',
      5000000,
      11,
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  const result = parseBulkInvoiceRows(rows, {
    mode: 'NEW',
    existingInvoices: existing,
    queryRows: sampleQueryRows,
    customers: [DEFAULT_VGREEN_CUSTOMER],
    settings: DEFAULT_SETTINGS,
    todayIso: '2026-11-20',
  });

  assert.equal(result.validCount, 2);
  assert.equal(result.errorCount, 2);

  // Check Row 2 (Vgreen)
  assert.equal(result.validInvoices[0].invoiceNumber, '850/INV/CLX/II/2026');
  assert.equal(result.validInvoices[0].invoiceDateDisplay, '01-Feb-2026');
  assert.equal(result.validInvoices[0].period, 'Feb-2026');
  assert.equal(result.validInvoices[0].consWoNumber, 'VGID-WO/BD/2026/IX/1142');

  // Check Row 3 failed anti double-billing
  assert.equal(result.rows[1].isValid, false);
  assert.ok(result.rows[1].errors[0].includes('35%'));

  // Check Row 4 (Non-Vgreen) got continuous 851 and queued new customer
  assert.equal(result.validInvoices[1].invoiceNumber, '851/INV/CLX/XI/2026');
  assert.equal(result.validInvoices[1].items[0].description, 'Instalasi Panel MDP Cikarang');
  assert.equal(result.newCustomersToCreate.length, 1);
  assert.equal(result.newCustomersToCreate[0].name, 'PT Sinar Energi Mandiri');

  // Check Row 5 failed missing manual item description
  assert.equal(result.rows[3].isValid, false);
  assert.ok(result.rows[3].errors.some((e) => e.includes('Item Description')));
});

test('parseBulkInvoiceRows (LEGACY mode) requires manual Invoice No, supports PAID status, and blocks duplicate invoice numbers', () => {
  const existing = [makeBaseInvoice({ invoiceNumber: '849/INV/CLX/XI/2026', seqNumber: 849 })];

  const rows: unknown[][] = [
    [...BULK_TEMPLATE_HEADERS],
    // Valid Legacy PAID
    [
      'PT Nusantara Energi Infrastruktur',
      'Menara Karya Lt. 12, Jakarta',
      'Panel Listrik',
      'Electrical',
      'PO-001',
      60,
      '2026-08-15',
      'Aug-2026',
      'Pengadaan Panel Listrik 60%',
      1,
      'Lot',
      20000000,
      11,
      '010.004-26.11111111',
      '840/INV/CLX/VIII/2026',
      'PAID',
      '2026-08-29',
      'BCA-TRF/20260829/999',
    ],
    // Duplicate invoice number -> must fail
    [
      'PT Nusantara Energi Infrastruktur',
      'Menara Karya Lt. 12, Jakarta',
      'Panel Listrik',
      'Electrical',
      'PO-002',
      35,
      '2026-11-10',
      'Nov-2026',
      'Pekerjaan Tambahan',
      1,
      'Lot',
      10000000,
      11,
      '',
      '849/INV/CLX/XI/2026',
      'UNPAID',
      '',
      '',
    ],
  ];

  const result = parseBulkInvoiceRows(rows, {
    mode: 'LEGACY',
    existingInvoices: existing,
    queryRows: sampleQueryRows,
    customers: [DEFAULT_VGREEN_CUSTOMER],
    settings: DEFAULT_SETTINGS,
  });

  assert.equal(result.validCount, 1);
  assert.equal(result.errorCount, 1);
  assert.equal(result.validInvoices[0].paymentStatus, 'PAID');
  assert.equal(result.validInvoices[0].paidDate, '2026-08-29');
  assert.equal(result.validInvoices[0].paymentRef, 'BCA-TRF/20260829/999');
  assert.equal(result.rows[1].isValid, false);
  assert.ok(result.rows[1].errors[0].includes('sudah ada'));
});

test('filterDashboardByCustomer filters invoices and conditionally shows Vgreen Query rows', () => {
  const invVgreen = makeBaseInvoice({ id: 'v1', billToName: DEFAULT_VGREEN_CUSTOMER.name });
  const invOther = makeBaseInvoice({
    id: 'o1',
    invoiceNumber: '850/INV/CLX/XI/2026',
    billToName: 'PT Nusantara Energi Infrastruktur',
  });

  const all = filterDashboardByCustomer([invVgreen, invOther], sampleQueryRows, 'ALL');
  assert.equal(all.filteredInvoices.length, 2);
  assert.equal(all.filteredQueryRows.length, 1);
  assert.equal(all.isAllSelected, true);

  const onlyOther = filterDashboardByCustomer(
    [invVgreen, invOther],
    sampleQueryRows,
    'PT Nusantara Energi Infrastruktur'
  );
  assert.equal(onlyOther.filteredInvoices.length, 1);
  assert.equal(onlyOther.filteredInvoices[0].id, 'o1');
  assert.equal(onlyOther.filteredQueryRows.length, 0);
  assert.equal(onlyOther.isVgreenSelected, false);

  const onlyVgreen = filterDashboardByCustomer(
    [invVgreen, invOther],
    sampleQueryRows,
    DEFAULT_VGREEN_CUSTOMER.name
  );
  assert.equal(onlyVgreen.filteredInvoices.length, 1);
  assert.equal(onlyVgreen.filteredQueryRows.length, 1);
  assert.equal(onlyVgreen.isVgreenSelected, true);
});
