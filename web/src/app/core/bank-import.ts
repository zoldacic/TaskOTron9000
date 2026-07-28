/**
 * Converters that turn a bank's exported statement file into the plain
 * tab-separated `date <tab> title <tab> amount` lines the import text box
 * (and the server-side ImportParser) understands.
 *
 * Which bank a file came from is read off its header row, so the user only has
 * to pick the file. Each format also owns its text encoding — the banks differ.
 */

export type BankFileType = 'SEB' | 'OKQ8';

/** Everything that differs between the banks: how to spot, decode and read a file. */
interface BankFileFormat {
  type: BankFileType;
  /** TextDecoder label for the file's bytes. */
  encoding: string;
  /** True when the file's first line is this bank's header row. */
  matchesHeader(line: string): boolean;
  parse(text: string): string[];
}

/**
 * Parses an SEB "kontoutdrag" CSV export (UTF-8 with a BOM).
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

/** A data row starts with a dd.MM.yyyy date; the header and footer rows do not. */
const OKQ8_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/**
 * Parses an OKQ8 credit-card "Transaktioner" CSV export (Windows-1252, no BOM).
 *
 * Columns are semicolon-separated:
 *   Datum;Typ;Beskrivning;Belopp in;Belopp ut;Valuta;Originalt belopp;Valuta;Kurs
 *
 * The file needs more repair than SEB's:
 *  - money in and money out live in separate columns, so the sign comes from
 *    which one is filled rather than from the value;
 *  - amounts are Swedish — a non-breaking space groups thousands and a comma is
 *    the decimal separator ("1 243,01"), and the bank's minus sign survived its
 *    own Latin-1 export as a literal "?" ("?1 243,01"). We keep only digits and
 *    separators and re-sign the value ourselves;
 *  - descriptions carry a ", <city>" suffix, dropped so the same merchant always
 *    yields the same title (title defaults and duplicate detection match on it);
 *  - the file ends with an empty row and an "Utgående saldo" footer, both of
 *    which have a full set of columns and so are skipped on the date instead.
 */
export function parseOkq8Csv(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: string[] = [];
  for (const line of lines) {
    const cols = line.split(';');
    if (cols.length < 5) continue;

    const day = OKQ8_DATE.exec(cols[0].trim());
    if (!day) continue; // header, blank row or the balance footer
    const date = `${day[3]}-${day[2]}-${day[1]}`;

    const title = cols[2].split(',')[0].trim(); // "Merchant, City" -> "Merchant"
    if (!title) continue;

    const out = okq8Amount(cols[4]); // Belopp ut
    const inc = okq8Amount(cols[3]); // Belopp in
    const amount = out ? `-${out}` : inc ? `+${inc}` : null;
    if (!amount) continue;

    rows.push(`${date}\t${title}\t${amount}`);
  }
  return rows;
}

/** "?1 243,01" -> "1243.01"; empty (or unparseable) becomes null. */
function okq8Amount(col: string): string | null {
  const cleaned = col.replace(/[^\d,.]/g, '').replace(',', '.');
  return /^\d/.test(cleaned) ? cleaned : null;
}

const BANK_FILE_FORMATS: BankFileFormat[] = [
  {
    type: 'SEB',
    encoding: 'utf-8', // TextDecoder strips the BOM itself
    matchesHeader: (line) => /(^|;)\s*valutadatum\s*(;|$)/i.test(line),
    parse: parseSebCsv,
  },
  {
    type: 'OKQ8',
    encoding: 'windows-1252',
    matchesHeader: (line) => /(^|;)\s*belopp ut\s*(;|$)/i.test(line),
    parse: parseOkq8Csv,
  },
];

/**
 * Works out which bank a chosen file came from, or null when none matches.
 *
 * The header is probed as Windows-1252 because that decoding never fails; the
 * column names we match on are plain ASCII in both formats either way.
 */
export function detectBankFileType(bytes: ArrayBuffer): BankFileType | null {
  const head = new TextDecoder('windows-1252').decode(bytes.slice(0, 512));
  const first = head.split(/\r?\n/)[0] ?? '';
  return BANK_FILE_FORMATS.find((f) => f.matchesHeader(first))?.type ?? null;
}

/** Decodes a bank export file's bytes using that bank's text encoding. */
export function decodeBankFile(type: BankFileType, bytes: ArrayBuffer): string {
  const format = BANK_FILE_FORMATS.find((f) => f.type === type);
  return new TextDecoder(format?.encoding ?? 'utf-8').decode(bytes);
}

/** Converts a bank export file's contents into import text-box lines. */
export function parseBankFile(type: BankFileType, text: string): string[] {
  return BANK_FILE_FORMATS.find((f) => f.type === type)?.parse(text) ?? [];
}
