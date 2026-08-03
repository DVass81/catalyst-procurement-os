import { extname } from "node:path";

import { strFromU8, unzipSync } from "fflate";
import { readSheet } from "read-excel-file/node";

export function controlledImportCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    throw new Error("IMPORT_CELL_TYPE_REJECTED");
  }
  const text = (
    value instanceof Date ? value.toISOString() : String(value)
  ).trim();
  if (text.startsWith("=")) throw new Error("FORMULAS_NOT_ALLOWED");
  return text;
}

function passesLuhn(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let total = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    doubleDigit = !doubleDigit;
  }
  return total % 10 === 0;
}

export function assertNoProhibitedImportCell(value: string) {
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(value)) {
    throw new Error("PROHIBITED_DATA_VALUE");
  }
  for (const candidate of value.match(/\b(?:\d[ -]?){13,19}\b/g) ?? []) {
    if (passesLuhn(candidate)) {
      throw new Error("PROHIBITED_DATA_VALUE");
    }
  }
}

export function parseControlledCsv(bytes: Buffer) {
  if (bytes.includes(0)) throw new Error("IMPORT_CONTENT_REJECTED");
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [[]];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      if (field) throw new Error("IMPORT_CSV_QUOTE_REJECTED");
      quoted = true;
    } else if (character === ",") {
      rows.at(-1)!.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)!.push(field);
      field = "";
      if (rows.at(-1)!.length > 500) throw new Error("IMPORT_COLUMN_LIMIT");
      if (rows.length > 25_001) throw new Error("IMPORT_ROW_LIMIT");
      rows.push([]);
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("IMPORT_CSV_QUOTE_REJECTED");
  rows.at(-1)!.push(field);
  if (
    rows.length > 1 &&
    rows.at(-1)!.length === 1 &&
    rows.at(-1)![0] === ""
  ) {
    rows.pop();
  }
  return rows;
}

export function inspectControlledXlsxArchive(bytes: Buffer) {
  let expandedBytes = 0;
  let worksheets: Record<string, Uint8Array>;
  try {
    worksheets = unzipSync(bytes, {
      filter(file) {
        expandedBytes += file.originalSize;
        if (expandedBytes > 75 * 1024 * 1024) {
          throw new Error("IMPORT_ARCHIVE_EXPANSION_REJECTED");
        }
        const name = file.name.toLowerCase();
        if (
          name.includes("vbaproject") ||
          name.endsWith(".bin") ||
          name.includes("externallinks/")
        ) {
          throw new Error("IMPORT_ACTIVE_CONTENT_REJECTED");
        }
        return /^xl\/worksheets\/[^/]+\.xml$/i.test(file.name);
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("IMPORT_")) {
      throw error;
    }
    throw new Error("IMPORT_ARCHIVE_REJECTED", { cause: error });
  }
  for (const worksheet of Object.values(worksheets)) {
    if (/<f(?:\s|>)/i.test(strFromU8(worksheet))) {
      throw new Error("FORMULAS_NOT_ALLOWED");
    }
  }
}

export async function loadControlledImportRows(file: File) {
  const extension = extname(file.name).toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  let rows: unknown[][];
  if (extension === ".xlsx") {
    if (
      file.type !==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new Error("IMPORT_TYPE_MISMATCH");
    }
    inspectControlledXlsxArchive(bytes);
    rows = await readSheet(bytes, 1);
  } else if (extension === ".csv") {
    if (!["text/csv", "application/csv"].includes(file.type)) {
      throw new Error("IMPORT_TYPE_MISMATCH");
    }
    rows = parseControlledCsv(bytes);
  } else {
    throw new Error("IMPORT_TYPE_REJECTED");
  }
  if (!rows.length) throw new Error("IMPORT_EMPTY");
  return { rows, bytes };
}
