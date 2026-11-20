import { jsPDF } from 'jspdf';
import type { InvoiceRecord } from '../types/invoice';
import {
  formatDateDdMmmYyyy,
  formatPeriodDisplay,
  formatRupiah,
} from './invoiceLogic';
import { loadClxLogoPngDataUrl } from '../components/ClxLogo';

/**
 * Generates an executive A4 PDF (210mm x 297mm) with the official PT. CLX logo,
 * architectural deep-navy & slate-steel bands (zero text collision & zero right-edge clipping),
 * MMM-YYYY period format, DD-MMM-YYYY invoice & signature dates, WO/PO No. label,
 * crisp tabular typography, termin breakdown, English amount in words, BCA payment box,
 * and balanced Head Office footer.
 */
export async function generateInvoicePdf(invoice: InvoiceRecord): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2; // 178mm (x: 16..194)

  // Authentic PT. CLX Brand Palette derived from official logo & existing invoice
  const deepNavy = [10, 31, 68] as const; // #0A1F44
  const slateSteel = [92, 118, 152] as const; // #5C7698
  const slateMuted = [100, 116, 139] as const; // #64748B
  const borderGray = [203, 213, 225] as const; // #CBD5E1
  const dividerSoft = [226, 232, 240] as const; // #E2E8F0
  const surfaceLight = [248, 250, 252] as const; // #F8FAFC
  const white = [255, 255, 255] as const;

  const formattedInvoiceDate = formatDateDdMmmYyyy(
    invoice.invoiceDate || invoice.invoiceDateDisplay,
    invoice.invoiceDateDisplay
  );
  const formattedPeriod = formatPeriodDisplay(
    invoice.period,
    invoice.invoiceDate || invoice.invoiceDateDisplay
  );

  // --- Top Architectural Header Band (Height: 31mm, Diagonal starts at x=144mm -> 10mm+ clear of address) ---
  const headerH = 31;
  doc.setFillColor(...deepNavy);
  doc.triangle(162, 0, pageWidth, 0, pageWidth, headerH, 'F');
  doc.triangle(162, 0, 150, headerH, pageWidth, headerH, 'F');

  doc.setFillColor(...slateSteel);
  doc.triangle(153, 0, 158, 0, 146, headerH, 'F');
  doc.triangle(153, 0, 141, headerH, 146, headerH, 'F');

  // Crisp full-width bottom rule under header band
  doc.setFillColor(...deepNavy);
  doc.rect(0, headerH, pageWidth, 1.2, 'F');

  // --- Official PT. CLX Logo & Brand Identity ---
  try {
    const logoUrl = await loadClxLogoPngDataUrl();
    if (logoUrl) {
      doc.addImage(logoUrl, 'PNG', marginX, 5.5, 19, 19);
    }
  } catch {
    doc.setFillColor(...deepNavy);
    doc.roundedRect(marginX, 6, 17, 17, 3, 3, 'F');
  }

  const brandTextX = marginX + 22; // 38mm
  const headerMaxTextW = 96; // ends at 134mm (7mm+ clean gap before steel diagonal at 141mm)

  doc.setTextColor(...deepNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17.5);
  doc.text('PT. CLX', brandTextX, 11.2);

  doc.setTextColor(...slateSteel);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PT. Connectivity Leads eXcellence', brandTextX, 15.5);

  doc.setTextColor(...slateMuted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.1);
  const headerAddrLines = doc.splitTextToSize(
    'Jl. M. Ali 2 No. 19 RT 007 RW 004 Tanah Baru, Beji, Kota Depok, Jawa Barat 16426',
    headerMaxTextW
  );
  doc.text(headerAddrLines, brandTextX, 19.6);
  const contactY = 19.6 + headerAddrLines.length * 3.3 + 0.5;
  doc.text('E : clx.central@gmail.com   ·   T : +62 82148581879', brandTextX, contactY);

  // --- Document Title ---
  doc.setTextColor(...deepNavy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('INVOICE', pageWidth - marginX, 46, { align: 'right' });

  doc.setDrawColor(...slateSteel);
  doc.setLineWidth(0.8);
  doc.line(pageWidth - marginX - 38, 48.5, pageWidth - marginX, 48.5);

  // --- Two-Column Metadata Section (Bill To vs Invoice Details) ---
  const metaTopY = 58;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...slateSteel);
  doc.text('BILL TO', marginX, metaTopY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...deepNavy);
  const billToNameLines = doc.splitTextToSize(invoice.billToName || '-', 82);
  doc.text(billToNameLines, marginX, metaTopY + 5.5);

  const addrStartY = metaTopY + 5.5 + billToNameLines.length * 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  const billToAddrLines = doc.splitTextToSize(invoice.billToAddress || '-', 82);
  doc.text(billToAddrLines, marginX, addrStartY);

  const rightColX = 112;
  const valueColX = 143;
  let ry = metaTopY;

  const drawMetaRow = (label: string, value: string, boldVal = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(...slateMuted);
    doc.text(label, rightColX, ry);

    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setTextColor(...deepNavy);
    doc.text(':', valueColX - 3, ry);
    const wrapped = doc.splitTextToSize(value || '-', pageWidth - marginX - valueColX);
    doc.text(wrapped, valueColX, ry);
    ry += Math.max(1, wrapped.length) * 5.2;
  };

  drawMetaRow('Invoice No.', invoice.invoiceNumber, true);
  drawMetaRow('Supplier', 'PT. Connectivity Leads eXcellence', true);
  drawMetaRow('Invoice Date', formattedInvoiceDate || '-');
  drawMetaRow('Project Type', invoice.chargingType || '-');
  drawMetaRow('WO/PO No.', invoice.consWoNumber || '-');
  drawMetaRow('Period', formattedPeriod || '-');
  drawMetaRow('No. Efaktur', invoice.noEfaktur || '-');

  // --- Items Table ---
  const tableStartY = Math.max(addrStartY + billToAddrLines.length * 4.5 + 8, ry + 6, 106);

  const colWidths = [11, 77, 14, 16, 30, 30];
  const colStarts = [
    marginX,
    marginX + colWidths[0],
    marginX + colWidths[0] + colWidths[1],
    marginX + colWidths[0] + colWidths[1] + colWidths[2],
    marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
    marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
  ];

  doc.setFillColor(...deepNavy);
  doc.rect(marginX, tableStartY, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...white);

  doc.text('NO.', colStarts[0] + colWidths[0] / 2, tableStartY + 5.8, { align: 'center' });
  doc.text('ITEM DESCRIPTION', colStarts[1] + 3, tableStartY + 5.8);
  doc.text('QTY', colStarts[2] + colWidths[2] / 2, tableStartY + 5.8, { align: 'center' });
  doc.text('UOM', colStarts[3] + colWidths[3] / 2, tableStartY + 5.8, { align: 'center' });
  doc.text('UNIT PRICE (IDR)', colStarts[4] + colWidths[4] - 3, tableStartY + 5.8, {
    align: 'right',
  });
  doc.text('AMOUNT (IDR)', colStarts[5] + colWidths[5] - 3, tableStartY + 5.8, {
    align: 'right',
  });

  let curY = tableStartY + 9;
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);

  invoice.items.forEach((item, index) => {
    const descLines = doc.splitTextToSize(item.description || '-', colWidths[1] - 6);
    const rowHeight = Math.max(10, descLines.length * 4.8 + 4);

    if (index % 2 === 1) {
      doc.setFillColor(...surfaceLight);
      doc.rect(marginX, curY, contentWidth, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...deepNavy);

    doc.text(String(index + 1), colStarts[0] + colWidths[0] / 2, curY + 6, { align: 'center' });
    doc.text(descLines, colStarts[1] + 3, curY + 6);
    doc.text(String(item.qty), colStarts[2] + colWidths[2] / 2, curY + 6, { align: 'center' });
    doc.text(item.uom, colStarts[3] + colWidths[3] / 2, curY + 6, { align: 'center' });
    doc.text(formatRupiah(item.unitPrice), colStarts[4] + colWidths[4] - 3, curY + 6, {
      align: 'right',
    });
    doc.text(formatRupiah(item.amount), colStarts[5] + colWidths[5] - 3, curY + 6, {
      align: 'right',
    });

    doc.rect(marginX, curY, contentWidth, rowHeight);
    curY += rowHeight;
  });

  for (let c = 1; c < colStarts.length; c++) {
    doc.line(colStarts[c], tableStartY, colStarts[c], curY);
  }

  // --- Summary Block ---
  const summaryStartY = curY;
  const leftSummaryWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  const rightLabelWidth = colWidths[4];
  const rightValueWidth = colWidths[5];
  const summaryRowH = 8.2;
  const totalSummaryH = summaryRowH * 4;

  doc.setFillColor(...surfaceLight);
  doc.rect(marginX, summaryStartY, leftSummaryWidth, totalSummaryH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...slateSteel);
  doc.text('TOTAL AMOUNT IN WORDS', marginX + 4, summaryStartY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...deepNavy);
  const wordsLines = doc.splitTextToSize(invoice.amountInWords, leftSummaryWidth - 8);
  doc.text(wordsLines, marginX + 4, summaryStartY + 15);

  const summaryRows = [
    { label: 'TOTAL', value: formatRupiah(invoice.contractAmount), highlight: false },
    { label: invoice.terminLabel, value: formatRupiah(invoice.terminAmount), highlight: false },
    { label: `TAX (${invoice.taxRate}%)`, value: formatRupiah(invoice.taxAmount), highlight: false },
    { label: 'GRAND TOTAL', value: formatRupiah(invoice.grandTotal), highlight: true },
  ];

  summaryRows.forEach((row, idx) => {
    const ryPos = summaryStartY + idx * summaryRowH;
    const xLabel = marginX + leftSummaryWidth;
    const xVal = xLabel + rightLabelWidth;

    if (row.highlight) {
      doc.setFillColor(...deepNavy);
      doc.rect(xLabel, ryPos, rightLabelWidth + rightValueWidth, summaryRowH, 'F');
      doc.setTextColor(...white);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(xLabel, ryPos, rightLabelWidth, summaryRowH, 'D');
      doc.rect(xVal, ryPos, rightValueWidth, summaryRowH, 'D');
      doc.setTextColor(...deepNavy);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(row.label, xLabel + rightLabelWidth - 2.5, ryPos + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.text(row.value, xVal + rightValueWidth - 3, ryPos + 5.5, { align: 'right' });
  });

  // --- Payment Info Box ---
  const paymentY = summaryStartY + totalSummaryH + 10;
  doc.setDrawColor(...borderGray);
  doc.setFillColor(...surfaceLight);
  doc.roundedRect(marginX, paymentY, 96, 29, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...deepNavy);
  doc.text('PAYMENT INFO', marginX + 4, paymentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Bank Name', marginX + 4, paymentY + 13);
  doc.text('Bank Account', marginX + 4, paymentY + 19);
  doc.text('Account Name', marginX + 4, paymentY + 25);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...deepNavy);
  doc.text(': BANK CENTRAL ASIA (BCA)', marginX + 29, paymentY + 13);
  doc.text(': 540-5282841', marginX + 29, paymentY + 19);
  doc.text(': PT. CONNECTIVITY LEADS EXCELLENCE', marginX + 29, paymentY + 25);

  if (invoice.paymentStatus === 'PAID') {
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.8);
    doc.roundedRect(marginX, paymentY + 34, 48, 11, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 163, 74);
    doc.text('PAID / TERVERIFIKASI', marginX + 24, paymentY + 40.8, { align: 'center' });
  }

  // --- Signature Block (DD-MMM-YYYY) ---
  const sigCenterX = pageWidth - marginX - 28;
  const sigTopY = paymentY + 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...deepNavy);
  doc.text(
    `${invoice.signatoryCity || 'Jakarta'}, ${formattedInvoiceDate}`,
    sigCenterX,
    sigTopY,
    { align: 'center' }
  );

  const nameY = sigTopY + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(invoice.signatoryName || 'Christian', sigCenterX, nameY, { align: 'center' });
  const nameW = doc.getTextWidth(invoice.signatoryName || 'Christian');
  doc.setDrawColor(...deepNavy);
  doc.setLineWidth(0.35);
  doc.line(sigCenterX - nameW / 2 - 2, nameY + 1.2, sigCenterX + nameW / 2 + 2, nameY + 1.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...slateMuted);
  doc.text(invoice.signatoryTitle || 'President Director', sigCenterX, nameY + 6, {
    align: 'center',
  });

  // --- Bottom Architectural Footer (Strictly constrained within 16mm right margin) ---
  const footerDividerY = pageHeight - 27;
  doc.setDrawColor(...dividerSoft);
  doc.setLineWidth(0.35);
  doc.line(marginX, footerDividerY, pageWidth - marginX, footerDividerY);

  // Clean bottom-left geometric accent (ends at x=88mm, well clear of text at x=106mm)
  doc.setFillColor(...deepNavy);
  doc.triangle(0, pageHeight - 11, 70, pageHeight - 11, 82, pageHeight, 'F');
  doc.triangle(0, pageHeight - 11, 0, pageHeight, 82, pageHeight, 'F');

  doc.setDrawColor(...slateSteel);
  doc.setLineWidth(1.1);
  doc.line(0, pageHeight - 14, 73, pageHeight - 14);
  doc.line(73, pageHeight - 14, 86, pageHeight);

  // Right-side Head Office block cleanly wrapped within [106mm .. 194mm] (88mm maxWidth)
  const footerTextX = 106;
  const footerMaxW = pageWidth - marginX - footerTextX; // 88mm
  const footerStartY = pageHeight - 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(...deepNavy);
  doc.text('PT. Connectivity Leads eXcellence', footerTextX, footerStartY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(...slateMuted);
  doc.text('Head Office', footerTextX, footerStartY + 3.6);

  const footerAddrLines = doc.splitTextToSize(
    'Jl. M. Ali 2 No. 19, RT 007 RW 004 Tanah Baru, Beji, Kota Depok, Jawa Barat 16426',
    footerMaxW
  );
  doc.text(footerAddrLines, footerTextX, footerStartY + 7.2);

  const footerEmailY = footerStartY + 7.2 + footerAddrLines.length * 3.3 + 0.4;
  doc.text('E : clx.central@gmail.com   ·   T : +62 82148581879', footerTextX, footerEmailY);

  const safeInvNo = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const locSeed = invoice.projectLocation || invoice.items[0]?.description || invoice.billToName || 'Invoice';
  const safeLoc = locSeed.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 48);
  doc.save(`${safeInvNo}_${safeLoc}.pdf`);
}
