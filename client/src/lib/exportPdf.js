import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from './fonts/robotoFont.js';

/**
 * jsPDF's built-in fonts (Helvetica etc.) only cover Latin/WinAnsi — any
 * Cyrillic text renders as garbage or blank boxes. Roboto (Apache 2.0,
 * embedded in lib/fonts/robotoFont.js) is registered once per document.
 */
function registerCyrillicFont(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto', 'normal');
}

/**
 * Renders a titled table to a landscape A4 PDF and triggers a download.
 * `columns`: [{ header, key }]; `rows`: array of plain objects.
 */
export function exportTablePdf({ title, columns, rows, filename }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  registerCyrillicFont(doc);

  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString('ru-RU'), 40, 52);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 64,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => row[c.key] ?? '')),
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 4 },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [124, 58, 237] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}
