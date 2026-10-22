import { calculateNote, evaluate, hasCalculation } from './note-calc';

describe('evaluate', () => {
  const none = new Map<string, number>();

  it('respects precedence, parentheses, unary minus and power', () => {
    expect(evaluate('2 + 3 * 4', none)).toBe(14);
    expect(evaluate('(2 + 3) * 4', none)).toBe(20);
    expect(evaluate('-2 + 5', none)).toBe(3);
    expect(evaluate('2 ^ 3 ^ 2', none)).toBe(512);
    expect(evaluate('-2 ^ 2', none)).toBe(-4);
    expect(evaluate('10 % 4', none)).toBe(2);
  });

  it('accepts a decimal comma', () => {
    expect(evaluate('12,5 * 2', none)).toBe(25);
  });

  it('reads variables, including Swedish letters', () => {
    expect(evaluate('hyra + mat', new Map([['hyra', 5000], ['mat', 3000]]))).toBe(8000);
    expect(evaluate('kött * 2', new Map([['kött', 50]]))).toBe(100);
  });

  it('returns null for malformed input, unknown names and division by zero', () => {
    expect(evaluate('2 +', none)).toBeNull();
    expect(evaluate('(2 + 3', none)).toBeNull();
    expect(evaluate('2 3', none)).toBeNull();
    expect(evaluate('x + 1', none)).toBeNull();
    expect(evaluate('1 / 0', none)).toBeNull();
    expect(evaluate('2 $ 3', none)).toBeNull();
    expect(evaluate('', none)).toBeNull();
  });
});

describe('calculateNote', () => {
  it('only reports a calculation when the note contains ==', () => {
    expect(hasCalculation('a = 1')).toBe(false);
    expect(hasCalculation('1 + 1 ==')).toBe(true);
  });

  it('writes the result after ==', () => {
    expect(calculateNote('2 + 3 ==')).toBe('2 + 3 == 5');
  });

  it('replaces a previous result on recalculation', () => {
    expect(calculateNote('2 + 3 == 99')).toBe('2 + 3 == 5');
  });

  it('uses assignments from earlier lines and leaves them untouched', () => {
    const note = 'rent = 5000\nfood = 120 * 4\nrent + food ==';
    expect(calculateNote(note)).toBe('rent = 5000\nfood = 120 * 4\nrent + food == 5480');
  });

  it('combines assignment and calculation on one line', () => {
    expect(calculateNote('a = 2\ntotal = a * 3 ==\ntotal + 1 =='))
      .toBe('a = 2\ntotal = a * 3 == 6\ntotal + 1 == 7');
  });

  it('marks lines it cannot evaluate with ?', () => {
    expect(calculateNote('missing + 1 ==')).toBe('missing + 1 == ?');
  });

  it('leaves plain text lines alone', () => {
    expect(calculateNote('Bought groceries\n1 + 1 ==')).toBe('Bought groceries\n1 + 1 == 2');
  });

  it('keeps the decimal comma when the line uses it, and rounds float noise', () => {
    expect(calculateNote('12,5 + 1 ==')).toBe('12,5 + 1 == 13,5');
    expect(calculateNote('0.1 + 0.2 ==')).toBe('0.1 + 0.2 == 0.3');
  });
});
