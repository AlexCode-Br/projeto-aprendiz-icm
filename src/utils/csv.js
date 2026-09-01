function protectedCell(value) {
  if (value == null) return '';
  const text = String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

function escapedCell(value) {
  return `"${protectedCell(value).replaceAll('"', '""')}"`;
}

export function buildCsv(headers, rows) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) throw new TypeError('Cabeçalhos e linhas do CSV precisam ser listas.');
  const width = headers.length;
  const lines = [headers, ...rows].map(row => {
    if (!Array.isArray(row) || row.length !== width) throw new TypeError('Todas as linhas do CSV precisam ter o mesmo número de colunas.');
    return row.map(escapedCell).join(';');
  });
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename, headers, rows) {
  const safeFilename = String(filename || 'exportacao.csv').replace(/[\\/:*?"<>|]/g, '_');
  const finalFilename = safeFilename.toLowerCase().endsWith('.csv') ? safeFilename : `${safeFilename}.csv`;
  const blob = new Blob([buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
