import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addOneYearIso,
  buildRetentionReminders,
  calculateInvoiceAmounts,
  generateNextInvoiceNumber,
  getTerminAvailability,
  numberToWords,
  parseQueryRows,
  parseSheetDateToIso,
  validateInvoiceForm,
  formatAuthErrorMessage,
} from './invoiceLogic';
import type { InvoiceRecord, QueryRow } from '../types/invoice';

function makeDummyInvoice(overrides: Partial<InvoiceRecord>): InvoiceRecord {
  return {
    id: 'inv-1',
    invoiceNumber: '849/INV/CLX/XI/2026',
    seqNumber: 849,
    mode: 'NEW',
    invoiceDate: '2026-11-17',
    invoiceDateDisplay: 'November 2026',
    period: 'November 2026',
    epcName: 'CLX',
    chargingType: 'BSS 6 Slot 1 Phase',
    projectLocation: 'KF 0016 Pekalongan',
    consWoNumber: 'VGID-WO/BD/2026/VIII/1098',
    queryDateIso: '2025-11-17',
    termin: 35,
    terminLabel: 'TERMIN 1 (35%)',
    contractAmount: 8500000,
    terminAmount: 2975000,
    taxRate: 11,
    taxAmount: 327250,
    grandTotal: 3302250,
    amountInWords: 'Three million, three hundred two thousand, two hundred fifty',
    noEfaktur: '',
    billToName: 'PT Vgreen Global Charging Station Investment Indonesia',
    billToAddress: 'Jakarta Selatan',
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
    retentionDueIso: '2026-11-17',
    signatoryName: 'Christian',
    signatoryTitle: 'President Director',
    signatoryCity: 'Jakarta',
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
    ...overrides,
  };
}

test('parseQueryRows filters strictly EPC=CLX and non-empty Col W', () => {
  const rowHeader = new Array(26).fill('');
  rowHeader[1] = 'EPC Name';
  rowHeader[2] = 'Charging Type';
  rowHeader[5] = 'Project / Location Name';
  rowHeader[22] = 'Cons WO number';
  rowHeader[24] = 'BAST Date';

  const validClx = new Array(26).fill('');
  validClx[1] = 'clx ';
  validClx[2] = 'BSS 6 Slot 1 Phase';
  validClx[5] = 'KF 0016 Pekalongan';
  validClx[22] = 'VGID-WO/BD/2026/VIII/1098';
  validClx[24] = '15/11/2025';

  const nonClx = new Array(26).fill('');
  nonClx[1] = 'OTHER_EPC';
  nonClx[2] = 'BSS 6 Slot 1 Phase';
  nonClx[5] = 'Site X';
  nonClx[22] = 'WO-123';

  const emptyWo = new Array(26).fill('');
  emptyWo[1] = 'CLX';
  emptyWo[2] = 'BSS 6 Slot 1 Phase';
  emptyWo[5] = 'Site Pending WO';
  emptyWo[22] = '   ';

  const parsed = parseQueryRows([rowHeader, validClx, nonClx, emptyWo]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].epcName, 'CLX');
  assert.equal(parsed[0].chargingType, 'BSS 6 Slot 1 Phase');
  assert.equal(parsed[0].projectLocation, 'KF 0016 Pekalongan');
  assert.equal(parsed[0].consWoNumber, 'VGID-WO/BD/2026/VIII/1098');
  assert.equal(parsed[0].colYDateIso, '2025-11-15');
  assert.equal(parsed[0].retentionDueIso, '2026-11-15');
});

test('Termin guard enforces 35% -> 60% -> 5% anti double-billing for same Charging Type & Project', () => {
  // Step 1: No invoices -> only 35% allowed
  const step1 = getTerminAvailability('BSS 6 Slot 1 Phase', 'KF 0016 Pekalongan', [], 'NEW');
  assert.deepEqual(step1.allowedTermins, [35]);
  assert.equal(step1.recommendedTermin, 35);

  // Step 2: 35% exists -> ONLY 60% allowed
  const inv35 = makeDummyInvoice({ id: 'i1', termin: 35 });
  const step2 = getTerminAvailability('BSS 6 Slot 1 Phase', 'KF 0016 Pekalongan', [inv35], 'NEW');
  assert.deepEqual(step2.allowedTermins, [60]);
  assert.equal(step2.recommendedTermin, 60);
  assert.ok(step2.lockedReasons[35]);

  // Step 3: Different Charging Type on same location is tracked separately
  const diffType = getTerminAvailability('BSS 12 Slot 3 Phase', 'KF 0016 Pekalongan', [inv35], 'NEW');
  assert.deepEqual(diffType.allowedTermins, [35]);

  // Step 4: 35% + 60% exist -> ONLY 5% allowed
  const inv60 = makeDummyInvoice({ id: 'i2', invoiceNumber: '850/INV/CLX/XI/2026', seqNumber: 850, termin: 60 });
  const step3 = getTerminAvailability('BSS 6 Slot 1 Phase', 'KF 0016 Pekalongan', [inv35, inv60], 'NEW');
  assert.deepEqual(step3.allowedTermins, [5]);

  // Step 5: All 3 exist -> none allowed
  const inv5 = makeDummyInvoice({ id: 'i3', invoiceNumber: '851/INV/CLX/XI/2026', seqNumber: 851, termin: 5 });
  const step4 = getTerminAvailability('BSS 6 Slot 1 Phase', 'KF 0016 Pekalongan', [inv35, inv60, inv5], 'NEW');
  assert.deepEqual(step4.allowedTermins, []);
});

test('generateNextInvoiceNumber increments without collision and formats Roman months', () => {
  const existing = [
    makeDummyInvoice({ invoiceNumber: '849/INV/CLX/XI/2026', seqNumber: 849 }),
    makeDummyInvoice({ id: 'i2', invoiceNumber: '850/INV/CLX/XI/2026', seqNumber: 850 }),
  ];

  const next = generateNextInvoiceNumber(existing, 850, '2026-11-17');
  assert.equal(next.seqNumber, 851);
  assert.equal(next.invoiceNumber, '851/INV/CLX/XI/2026');

  const dec = generateNextInvoiceNumber(existing, 850, '2026-12-01');
  assert.equal(dec.invoiceNumber, '851/INV/CLX/XII/2026');
});

test('calculateInvoiceAmounts and numberToWords match existing PT. CLX invoice reference', () => {
  const calc = calculateInvoiceAmounts(
    [{ id: '1', description: 'KF 0016 Pekalongan', qty: 1, uom: 'Unit', unitPrice: 8500000, amount: 8500000 }],
    60,
    11
  );
  assert.equal(calc.contractAmount, 8500000);
  assert.equal(calc.terminAmount, 5100000);
  assert.equal(calc.taxAmount, 561000);
  assert.equal(calc.grandTotal, 5661000);
  assert.equal(calc.amountInWords, 'Five million, six hundred sixty-one thousand');
  assert.equal(numberToWords(5661000), 'Five million, six hundred sixty-one thousand');
});

test('parseSheetDateToIso, addOneYearIso, and buildRetentionReminders compute 1-year Termin 5% alerts', () => {
  assert.equal(parseSheetDateToIso('17/11/2025'), '2025-11-17');
  assert.equal(parseSheetDateToIso('2025-10-01'), '2025-10-01');
  assert.equal(parseSheetDateToIso('15 Nov 2025'), '2025-11-15');
  assert.equal(addOneYearIso('2024-02-29'), '2025-02-28');

  const queryRows: QueryRow[] = [
    {
      rowIndex: 2,
      epcName: 'CLX',
      chargingType: 'BSS 6 Slot 1 Phase',
      projectLocation: 'KF 0016 Pekalongan',
      consWoNumber: 'WO-1',
      colYDateRaw: '01/11/2025',
      colYDateIso: '2025-11-01',
      retentionDueIso: '2026-11-01',
    },
    {
      rowIndex: 3,
      epcName: 'CLX',
      chargingType: 'BSS 6 Slot 1 Phase',
      projectLocation: 'SPKLU Bandung',
      consWoNumber: 'WO-2',
      colYDateRaw: '10/12/2025',
      colYDateIso: '2025-12-10',
      retentionDueIso: '2026-12-10',
    },
  ];

  const reminders = buildRetentionReminders(queryRows, [], '2026-11-17');
  assert.equal(reminders[0].projectLocation, 'KF 0016 Pekalongan');
  assert.equal(reminders[0].urgency, 'OVERDUE');
  assert.equal(reminders[0].daysRemaining, -16);
  assert.equal(reminders[1].projectLocation, 'SPKLU Bandung');
  assert.equal(reminders[1].urgency, 'DUE_SOON');
  assert.equal(reminders[1].daysRemaining, 23);
});

test('validateInvoiceForm rejects duplicate invoice number even in LEGACY mode', () => {
  const existing = [makeDummyInvoice({ invoiceNumber: '849/INV/CLX/XI/2026', seqNumber: 849, termin: 35 })];
  const err = validateInvoiceForm({
    mode: 'LEGACY',
    invoiceNumber: '849/INV/CLX/XI/2026',
    chargingType: 'BSS 6 Slot 1 Phase',
    projectLocation: 'KF 0016 Pekalongan',
    consWoNumber: 'WO-1',
    termin: 60,
    items: [{ id: '1', description: 'Item', qty: 1, uom: 'Unit', unitPrice: 1000000, amount: 1000000 }],
    existingInvoices: existing,
  });
  assert.ok(err && err.includes('sudah ada'));
});

test('formatAuthErrorMessage provides clear Indonesian guidance for OAuth & domain errors', () => {
  const domainErr = formatAuthErrorMessage({ code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' });
  assert.ok(domainErr.includes('Authorized domains'));

  const deniedErr = formatAuthErrorMessage(new Error('Access blocked: Error 403: access_denied'));
  assert.ok(deniedErr.includes('Test users'));
});

