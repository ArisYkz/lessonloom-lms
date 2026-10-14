// RFC 4180 CSV: CRLF between records, a value quoted when it contains a comma, a quote,
// a line break, or edge whitespace that a reader would otherwise trim. Quotes double.
function cell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text) && text.trim() === text) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + (rows.length ? "\r\n" : "");
}
