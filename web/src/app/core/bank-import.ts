/**
 * Converters that turn a bank's exported statement file into the plain
 * tab-separated `date <tab> title <tab> amount` lines the import text box
 * (and the server-side ImportParser) understands.
 */

export type BankFileType = 'SEB';

export const BANK_FILE_TYPES: BankFileType[] = ['SEB'];

/**
 * Parses an SEB "kontoutdrag" CSV export.
 *
 * Columns are semicolon-separated:
 *   Bokföringsdatum;Valutadatum;Verifikationsnummer;Text;Belopp;Saldo
 *
 * We use Valutadatum as the date, Text as the title and Belopp as the amount,
 * and ignore Bokföringsdatum, Verifikationsnummer and Saldo. Belopp uses a dot
 * as the decimal separator (e.g. "-253.520"), which the import parser reads
 * as-is.
 */
export function parseSebCsv(text: string): string[] {
  const lines = text
    .replace(/^﻿/, '') // strip UTF-8 BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Drop the header row when present.
  const start = /(^|;)\s*valutadatum\s*(;|$)/i.test(lines[0]) ? 1 : 0;

  const rows: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 5) continue;
    const date = cols[1].trim(); // Valutadatum
    const title = cols[3].trim(); // Text
    const amount = cols[4].trim(); // Belopp
    if (!date && !title && !amount) continue;
    rows.push(`${date}\t${title}\t${amount}`);
  }
  return rows;
}

/** Converts a bank export file's contents into import text-box lines. */
export function parseBankFile(type: BankFileType, text: string): string[] {
  switch (type) {
    case 'SEB':
      return parseSebCsv(text);
    default:
      return [];
  }
}
