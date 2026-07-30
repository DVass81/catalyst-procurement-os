import "server-only";

import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";

import type { DemoState } from "@/demo/model";

type ReportFormat = "pdf" | "xlsx" | "csv";

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function printable(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, " ").trim();
}

function pdfString(value: string) {
  return printable(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function readablePdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 10 Tf",
    "50 742 Td",
    "14 TL",
    ...lines.slice(0, 45).flatMap((line, index) => [
      `(${pdfString(line).slice(0, 96)}) Tj`,
      ...(index === lines.length - 1 ? [] : ["T*"]),
    ]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(document);
}

function workbook(rows: Array<[string, number, string]>) {
  const sheetRows = [
    ["Certified measure", "Value", "Source hash"] as const,
    ...rows,
  ]
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) => {
            const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
            return typeof cell === "number"
              ? `<c r="${reference}"><v>${cell}</v></c>`
              : `<c r="${reference}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const files = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Certified Measures" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

export function buildReportExport(
  state: DemoState,
  snapshotId: string,
  format: ReportFormat,
) {
  const snapshot = state.phaseThree.reportSnapshots.find(
    (candidate) => candidate.id === snapshotId,
  );
  if (!snapshot) throw new Error("REPORT_SNAPSHOT_NOT_FOUND");
  const definition = state.phaseThree.reportDefinitions.find(
    (candidate) => candidate.id === snapshot.reportId,
  );
  if (!definition) throw new Error("REPORT_DEFINITION_NOT_FOUND");
  const rows = Object.entries(snapshot.measures).map(
    ([measure, value]) =>
      [measure, value, snapshot.sourceHash] as [string, number, string],
  );
  let buffer: Buffer;
  let contentType: string;
  if (format === "csv") {
    buffer = Buffer.from(
      [
        ["certified_measure", "value", "source_hash"].map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
      ].join("\r\n"),
    );
    contentType = "text/csv; charset=utf-8";
  } else if (format === "xlsx") {
    buffer = workbook(rows);
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    buffer = readablePdf([
      "Catalyst Procurement OS - Governed Synthetic Report",
      `Report: ${definition.name}`,
      `Snapshot: ${snapshot.id}`,
      `As of: ${snapshot.asOf}`,
      `Dataset: ${state.phaseThree.dataset.version}`,
      `Source hash: ${snapshot.sourceHash}`,
      "Synthetic demonstration only. No realized customer result is represented.",
      ...rows.map(([measure, value]) => `${measure}: ${value}`),
      "CATE remains advisory. Human decision authority is required.",
    ]);
    contentType = "application/pdf";
  }
  return {
    buffer,
    contentType,
    filename: `${snapshot.id}.${format}`,
    sha256: sha256(buffer),
  };
}
