import { parseSebCsv, parseBankFile } from './bank-import';

describe('bank-import', () => {
  const csv = [
    'Bokföringsdatum;Valutadatum;Verifikationsnummer;Text;Belopp;Saldo',
    '2026-07-17;2026-07-16;5484012629;SAN FRANCISC/26-07-16;-253.520;2762.720',
    '2026-07-13;2026-07-13;5490990789;46730396076;75.000;7614.170',
  ].join('\r\n');

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

  it('parseBankFile routes SEB to the SEB parser', () => {
    expect(parseBankFile('SEB', csv)).toEqual(parseSebCsv(csv));
  });
});
