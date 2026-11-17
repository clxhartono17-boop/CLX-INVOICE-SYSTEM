import type {
  InvoiceLineItem,
  InvoiceMode,
  InvoiceRecord,
  PaymentStatus,
  QueryRow,
  TerminPercent,
} from '../types/invoice';
import { parseQueryRows } from '../utils/invoiceLogic';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const INVOICE_SHEET_HEADERS = [
  'ID',
  'Invoice Number',
  'Seq Number',
  'Mode',
  'Invoice Date',
  'Invoice Date Display',
  'Period',
  'EPC Name',
  'Charging Type',
  'Project / Location Name',
  'Cons WO Number',
  'Query Date (Col Y)',
  'Termin (%)',
  'Termin Label',
  'Contract Amount',
  'Termin Amount',
  'Tax Rate (%)',
  'Tax Amount',
  'Grand Total',
  'Amount In Words',
  'No. Efaktur',
  'Bill To Name',
  'Bill To Address',
  'Items JSON',
  'Payment Status',
  'Paid Date',
  'Payment Ref',
  'Payment Note',
  'Retention 5% Due Date',
  'Signatory Name',
  'Signatory Title',
  'Signatory City',
  'Created At',
  'Updated At',
];

interface SheetMetadataResponse {
  spreadsheetId: string;
  properties?: { title?: string };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Google Sheets API Error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function fetchSpreadsheetInfo(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheetTabs: Array<{ sheetId: number; title: string }> }> {
  const data = await sheetsFetch<SheetMetadataResponse>(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`,
    accessToken
  );

  const sheetTabs = (data.sheets || [])
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
    }))
    .filter((s) => s.title);

  return {
    title: data.properties?.title || 'Google Spreadsheet',
    sheetTabs,
  };
}

export async function readQuerySheet(
  spreadsheetId: string,
  accessToken: string,
  querySheetName = 'Query'
): Promise<QueryRow[]> {
  const info = await fetchSpreadsheetInfo(spreadsheetId, accessToken);
  const actualTab =
    info.sheetTabs.find((t) => t.title.toLowerCase() === querySheetName.toLowerCase())?.title ||
    querySheetName;

  const range = encodeURIComponent(`'${actualTab}'!A:Z`);
  const data = await sheetsFetch<{ values?: string[][] }>(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    accessToken
  );

  return parseQueryRows(data.values || []);
}

export async function ensureInvoicesSheet(
  spreadsheetId: string,
  accessToken: string,
  invoicesSheetName = 'Invoices_DB'
): Promise<{ created: boolean; sheetName: string }> {
  const info = await fetchSpreadsheetInfo(spreadsheetId, accessToken);
  const existing = info.sheetTabs.find(
    (t) => t.title.toLowerCase() === invoicesSheetName.toLowerCase()
  );

  if (existing) {
    // Check if row 1 already has headers; if empty, populate headers
    const checkRange = encodeURIComponent(`'${existing.title}'!A1:AH1`);
    const headerRes = await sheetsFetch<{ values?: string[][] }>(
      `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${checkRange}`,
      accessToken
    );
    if (!headerRes.values || headerRes.values.length === 0 || !headerRes.values[0]?.[0]) {
      await writeHeaderRowAndFormat(spreadsheetId, accessToken, existing.title, existing.sheetId);
    }
    return { created: false, sheetName: existing.title };
  }

  // Create new sheet tab via batchUpdate
  const addRes = await sheetsFetch<{
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }>;
  }>(`${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: invoicesSheetName,
              gridProperties: {
                frozenRowCount: 1,
                rowCount: 1000,
                columnCount: INVOICE_SHEET_HEADERS.length,
              },
            },
          },
        },
      ],
    }),
  });

  const newSheetId = addRes.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
  await writeHeaderRowAndFormat(spreadsheetId, accessToken, invoicesSheetName, newSheetId);
  return { created: true, sheetName: invoicesSheetName };
}

async function writeHeaderRowAndFormat(
  spreadsheetId: string,
  accessToken: string,
  sheetName: string,
  sheetId: number
): Promise<void> {
  const headerRange = encodeURIComponent(`'${sheetName}'!A1:AH1`);
  await sheetsFetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [INVOICE_SHEET_HEADERS],
      }),
    }
  );

  // Format header row cleanly (deep navy background, white bold text, frozen row 1, auto-resize)
  await sheetsFetch(`${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: INVOICE_SHEET_HEADERS.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  fontSize: 10,
                  bold: true,
                },
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ],
    }),
  });
}

function invoiceToRow(inv: InvoiceRecord): (string | number)[] {
  return [
    inv.id,
    inv.invoiceNumber,
    inv.seqNumber,
    inv.mode,
    inv.invoiceDate,
    inv.invoiceDateDisplay,
    inv.period,
    inv.epcName,
    inv.chargingType,
    inv.projectLocation,
    inv.consWoNumber,
    inv.queryDateIso || '',
    inv.termin,
    inv.terminLabel,
    inv.contractAmount,
    inv.terminAmount,
    inv.taxRate,
    inv.taxAmount,
    inv.grandTotal,
    inv.amountInWords,
    inv.noEfaktur,
    inv.billToName,
    inv.billToAddress,
    JSON.stringify(inv.items),
    inv.paymentStatus,
    inv.paidDate,
    inv.paymentRef,
    inv.paymentNote,
    inv.retentionDueIso || '',
    inv.signatoryName,
    inv.signatoryTitle,
    inv.signatoryCity,
    inv.createdAt,
    inv.updatedAt,
  ];
}

function rowToInvoice(row: string[], rowIndex: number): InvoiceRecord | null {
  const id = (row[0] || '').trim();
  const invoiceNumber = (row[1] || '').trim();
  if (!id && !invoiceNumber) return null;

  let items: InvoiceLineItem[] = [];
  try {
    const parsed = JSON.parse(row[23] || '[]');
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }

  const terminRaw = Number(row[12]);
  const termin: TerminPercent = terminRaw === 60 ? 60 : terminRaw === 5 ? 5 : 35;
  const mode: InvoiceMode = (row[3] || '').toUpperCase() === 'LEGACY' ? 'LEGACY' : 'NEW';
  const paymentStatus: PaymentStatus =
    (row[24] || '').toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';

  return {
    id: id || `row-${rowIndex}`,
    rowIndex,
    invoiceNumber,
    seqNumber: Number(row[2]) || 0,
    mode,
    invoiceDate: row[4] || '',
    invoiceDateDisplay: row[5] || '',
    period: row[6] || '',
    epcName: row[7] || 'CLX',
    chargingType: row[8] || '',
    projectLocation: row[9] || '',
    consWoNumber: row[10] || '',
    queryDateIso: row[11] ? row[11] : null,
    termin,
    terminLabel: row[13] || `TERMIN (${termin}%)`,
    contractAmount: Number(row[14]) || 0,
    terminAmount: Number(row[15]) || 0,
    taxRate: Number(row[16]) || 11,
    taxAmount: Number(row[17]) || 0,
    grandTotal: Number(row[18]) || 0,
    amountInWords: row[19] || '',
    noEfaktur: row[20] || '',
    billToName: row[21] || '',
    billToAddress: row[22] || '',
    items,
    paymentStatus,
    paidDate: row[25] || '',
    paymentRef: row[26] || '',
    paymentNote: row[27] || '',
    retentionDueIso: row[28] ? row[28] : null,
    signatoryName: row[29] || 'Christian',
    signatoryTitle: row[30] || 'President Director',
    signatoryCity: row[31] || 'Jakarta',
    createdAt: row[32] || '',
    updatedAt: row[33] || '',
  };
}

export async function readInvoicesSheet(
  spreadsheetId: string,
  accessToken: string,
  invoicesSheetName = 'Invoices_DB'
): Promise<InvoiceRecord[]> {
  const { sheetName } = await ensureInvoicesSheet(spreadsheetId, accessToken, invoicesSheetName);
  const range = encodeURIComponent(`'${sheetName}'!A2:AH`);
  const data = await sheetsFetch<{ values?: string[][] }>(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    accessToken
  );

  const records: InvoiceRecord[] = [];
  (data.values || []).forEach((row, idx) => {
    const parsed = rowToInvoice(
      row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
      idx + 2
    );
    if (parsed) records.push(parsed);
  });

  return records;
}

export async function appendInvoiceRow(
  spreadsheetId: string,
  accessToken: string,
  invoice: InvoiceRecord,
  invoicesSheetName = 'Invoices_DB'
): Promise<InvoiceRecord> {
  const { sheetName } = await ensureInvoicesSheet(spreadsheetId, accessToken, invoicesSheetName);
  const range = encodeURIComponent(`'${sheetName}'!A:AH`);

  const res = await sheetsFetch<{ updates?: { updatedRange?: string } }>(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [invoiceToRow(invoice)],
      }),
    }
  );

  // Extract assigned row index from updatedRange e.g. "'Invoices_DB'!A15:AH15"
  let rowIndex = invoice.rowIndex;
  const match = res.updates?.updatedRange?.match(/![A-Z]+(\d+):/);
  if (match && match[1]) {
    rowIndex = Number(match[1]);
  }

  return { ...invoice, rowIndex };
}

export async function updateInvoiceRow(
  spreadsheetId: string,
  accessToken: string,
  invoice: InvoiceRecord,
  invoicesSheetName = 'Invoices_DB'
): Promise<InvoiceRecord> {
  if (!invoice.rowIndex) {
    // Fallback: look up rowIndex by ID
    const all = await readInvoicesSheet(spreadsheetId, accessToken, invoicesSheetName);
    const found = all.find((r) => r.id === invoice.id);
    if (!found || !found.rowIndex) {
      throw new Error(`Baris invoice "${invoice.invoiceNumber}" tidak ditemukan di Google Sheet.`);
    }
    invoice = { ...invoice, rowIndex: found.rowIndex };
  }

  const range = encodeURIComponent(`'${invoicesSheetName}'!A${invoice.rowIndex}:AH${invoice.rowIndex}`);
  await sheetsFetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [invoiceToRow(invoice)],
      }),
    }
  );

  return invoice;
}
