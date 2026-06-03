export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function sanitizeCsvFilename(part: string): string {
  return part.replace(/[^\w\u0600-\u06FF.-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
}
