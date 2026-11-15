import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";

const PAGE_MARGIN = 36;
const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 18;

function truncate(text, maxLen) {
  const s = String(text ?? "");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/**
 * pdfkit/fontkit chargés à l'exécution seulement (évite ERR_ENCODING_NOT_SUPPORTED
 * lors de l'analyse du codebase Firebase au deploy).
 */
async function loadPdfDocument() {
  const mod = await import("pdfkit");
  return mod.default;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {string[]} opts.header
 * @param {string[][]} opts.rows
 * @returns {Promise<Buffer>}
 */
export async function buildParticipationReportPdfBuffer({ title, subtitle, header, rows }) {
  const PDFDocument = await loadPdfDocument();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margin: PAGE_MARGIN,
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#444444").text(subtitle);
    doc.moveDown(0.8);
    doc.fillColor("#000000");

    const tableTop = doc.y;
    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const colCount = header.length;
    const colWidth = pageWidth / colCount;

    doc.fontSize(7).font("Helvetica-Bold");
    header.forEach((label, i) => {
      doc.text(truncate(label, 18), PAGE_MARGIN + i * colWidth, tableTop, {
        width: colWidth - 4,
        lineBreak: false,
      });
    });

    let y = tableTop + HEADER_HEIGHT;
    doc.font("Helvetica");

    for (const row of rows) {
      if (y > doc.page.height - PAGE_MARGIN - ROW_HEIGHT) {
        doc.addPage({ layout: "landscape", margin: PAGE_MARGIN });
        y = PAGE_MARGIN;
      }

      row.forEach((cell, i) => {
        doc.text(truncate(cell, 22), PAGE_MARGIN + i * colWidth, y, {
          width: colWidth - 4,
          lineBreak: false,
        });
      });

      y += ROW_HEIGHT;
    }

    doc.end();
  });
}

export async function writeParticipationReportPdf({ outputPath, title, subtitle, header, rows }) {
  const buffer = await buildParticipationReportPdfBuffer({ title, subtitle, header, rows });
  const stream = createWriteStream(outputPath);
  stream.write(buffer);
  stream.end();
  await finished(stream);
  return { outputPath, bytes: buffer.length };
}
