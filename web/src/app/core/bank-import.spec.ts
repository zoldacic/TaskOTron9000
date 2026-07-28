import { parseSebCsv, parseOkq8Csv, parseBankFile, detectBankFileType, decodeBankFile } from './bank-import';

/** Bytes as the banks write them: SEB exports UTF-8, OKQ8 Windows-1252. */
const utf8 = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer;
const cp1252 = (s: string): ArrayBuffer =>
  new Uint8Array([...s].map((c) => c.charCodeAt(0))).buffer;

describe('bank-import', () => {
  const csv = [
    'Bokföringsdatum;Valutadatum;Verifikationsnummer;Text;Belopp;Saldo',
    '2026-07-17;2026-07-16;5484012629;SAN FRANCISC/26-07-16;-253.520;2762.720',
    '2026-07-13;2026-07-13;5490990789;46730396076;75.000;7614.170',
  ].join('\r\n');

  // Real OKQ8 rows: a non-breaking space groups thousands, the minus sign is a
  // literal "?", and the file ends with an empty row plus a balance footer.
  const okq8 = [
    'Datum;Typ;Beskrivning;Belopp in;Belopp ut;Valuta;Originalt belopp;Valuta;Kurs',
    '28.07.2026;Köp;Bg Inbetalning;15 400,00;;SEK;15 400,00;SEK;-',
    '27.07.2026;Köp;OKQ8 Skellefteå Solb, Skellefteå;;?1 243,01;SEK;?1 243,01;SEK;-',
    '23.07.2026;Köp;Stora Coop Sorbole, Skelleftea;;?588,25;SEK;?588,25;SEK;-',
    ';;;;;;;;',
    'Utgående saldo per :;-5 429,52 SEK;;;;;;;',
  ].join('\n');

  it('maps Valutadatum, Text and Belopp into tab-separated rows', () => {
    expect(parseSebCsv(csv)).toEqual([
      '2026-07-16\tSAN FRANCISC/26-07-16\t-253.520',
      '2026-07-13\t46730396076\t75.000',
    ]);
  });

  it('drops the header row and skips blank lines', () => {
    const withBlanks = csv + '\r\n\r\n';
    expect(parseSebCsv(withBlanks)).toHaveLength(2);
  });

  it('handles a leading UTF-8 BOM', () => {
    expect(parseSebCsv('﻿' + csv)).toHaveLength(2);
  });

  it('signs OKQ8 rows from the in/out column and normalizes Swedish amounts', () => {
    expect(parseOkq8Csv(okq8)).toEqual([
      '2026-07-28\tBg Inbetalning\t+15400.00',
      '2026-07-27\tOKQ8 Skellefteå Solb\t-1243.01',
      '2026-07-23\tStora Coop Sorbole\t-588.25',
    ]);
  });

  it('skips the OKQ8 header, empty row and balance footer', () => {
    const junk = [
      'Datum;Typ;Beskrivning;Belopp in;Belopp ut;Valuta;Originalt belopp;Valuta;Kurs',
      ';;;;;;;;',
      'Utgående saldo per :;-5 429,52 SEK;;;;;;;',
    ].join('\n');
    expect(parseOkq8Csv(junk)).toEqual([]);
  });

  it('parseBankFile routes each type to its parser', () => {
    expect(parseBankFile('SEB', csv)).toEqual(parseSebCsv(csv));
    expect(parseBankFile('OKQ8', okq8)).toEqual(parseOkq8Csv(okq8));
  });

  it('detects the bank from the header row', () => {
    expect(detectBankFileType(utf8('﻿' + csv))).toBe('SEB');
    expect(detectBankFileType(cp1252(okq8))).toBe('OKQ8');
    expect(detectBankFileType(utf8('a;b;c\n1;2;3'))).toBeNull();
  });

  it('decodes each bank file with its own encoding', () => {
    expect(decodeBankFile('OKQ8', cp1252(okq8))).toContain('OKQ8 Skellefteå Solb, Skellefteå');
    expect(decodeBankFile('SEB', utf8('﻿' + csv))).toContain('Bokföringsdatum');
  });
});
