// Spreadsheet-safe CSV: quotes every cell, and a leading = + - @ gets a ' so Excel won't run it as a formula
export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  // BOM so Excel reads names with accents correctly
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
