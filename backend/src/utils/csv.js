// Builds a CSV string that opens cleanly in Excel.
// Every field is quoted, and values starting with = + - @ are prefixed with '
// so a spreadsheet never runs them as formulas (CSV injection).

function escapeCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  // BOM so Excel detects UTF-8; CRLF line endings per RFC 4180
  return `﻿${lines.join('\r\n')}\r\n`;
}

module.exports = { toCsv, escapeCell };
