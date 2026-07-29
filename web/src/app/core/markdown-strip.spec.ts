import { stripMarkdown } from './markdown-strip';

describe('stripMarkdown', () => {
  it('unwraps bold', () => {
    expect(stripMarkdown('You have two: **OKQ8** and **SEB Main**.'))
      .toBe('You have two: OKQ8 and SEB Main.');
    expect(stripMarkdown('__also bold__')).toBe('also bold');
  });

  it('unwraps inline code and strikethrough', () => {
    expect(stripMarkdown('the `query_tasks` tool')).toBe('the query_tasks tool');
    expect(stripMarkdown('~~scratch that~~')).toBe('scratch that');
  });

  it('drops heading markers but keeps the heading text', () => {
    expect(stripMarkdown('## June 2026\nspent 100')).toBe('June 2026\nspent 100');
  });

  it('turns a link into label plus url', () => {
    expect(stripMarkdown('see [the report](http://x/y) for more'))
      .toBe('see the report (http://x/y) for more');
  });

  it('leaves list bullets alone — they read fine as plain text', () => {
    const list = '- Matvaror: 12 062,73 kr\n- Snabbmat: 1 641 kr';
    expect(stripMarkdown(list)).toBe(list);
  });

  // The reason single-character markers are left alone: imported merchant names
  // are full of them, and mangling those would corrupt the quoted titles.
  it('does not touch asterisks inside merchant names', () => {
    expect(stripMarkdown('K*COOP.SE and Surf*alhems Trdgrd'))
      .toBe('K*COOP.SE and Surf*alhems Trdgrd');
  });

  it('does not touch underscores inside merchant names', () => {
    expect(stripMarkdown('Zettle_*raddningstjansten, Skelleftea'))
      .toBe('Zettle_*raddningstjansten, Skelleftea');
  });

  it('unwraps bold even when the text around it has single asterisks', () => {
    expect(stripMarkdown('**K*COOP.SE** was the biggest'))
      .toBe('K*COOP.SE was the biggest');
  });

  it('leaves an unclosed marker alone so streaming text stays stable', () => {
    // Mid-stream the closing ** has not arrived yet; it resolves once it does.
    expect(stripMarkdown('You have two: **OKQ')).toBe('You have two: **OKQ');
  });

  it('passes ordinary text through untouched', () => {
    const plain = 'Du la 14 053,73 kr på mat i juni 2026 (35 köp).';
    expect(stripMarkdown(plain)).toBe(plain);
  });
});
