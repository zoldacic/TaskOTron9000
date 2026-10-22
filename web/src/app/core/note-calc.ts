// Calculations inside free-text notes, evaluated line by line from the top.
//
//   rent = 5000                  single `=` assigns (the value may itself be a calculation)
//   food = 120 * 4               assigns 480
//   rent + food ==               `==` calculates: the result is written after it
//   total = rent + food == 5480  assignment and calculation can be combined
//
// Re-running replaces whatever follows `==`, so results stay current after edits.
// A line that can't be evaluated gets `?` as its result. Numbers accept `.` or `,`
// as decimal separator; a result uses `,` when its line did.

/** True when the note has something to (re)calculate. */
export function hasCalculation(note: string): boolean {
  return note.includes('==');
}

const ASSIGN = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)(.*)$/u;

/** Returns the note with every `==` result (re)computed. */
export function calculateNote(note: string): string {
  const vars = new Map<string, number>();
  return note.split('\n').map((line) => {
    const eq = line.indexOf('==');
    const left = eq < 0 ? line : line.slice(0, eq);
    const assign = ASSIGN.exec(left);
    const expr = assign ? assign[2] : left;
    if (eq < 0 && !assign) return line;

    const value = evaluate(expr, vars);
    if (assign && value != null) vars.set(assign[1], value);
    if (eq < 0) return line;
    const comma = /\d,\d/.test(expr);
    return `${left.trimEnd()} == ${value == null ? '?' : format(value, comma)}`;
  }).join('\n');
}

function format(n: number, comma: boolean): string {
  // Round away float noise (0.1 + 0.2) without forcing decimals on whole numbers.
  const s = String(parseFloat(n.toFixed(10)));
  return comma ? s.replace('.', ',') : s;
}

/** Evaluates an arithmetic expression; null when it's malformed or uses an unknown name. */
export function evaluate(expr: string, vars: ReadonlyMap<string, number>): number | null {
  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const peek = () => tokens[pos];

  // Recursive descent: sum -> product -> unary -> power -> atom.
  const sum = (): number | null => {
    let v = product();
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = tokens[pos++];
      const r = product();
      if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const product = (): number | null => {
    let v = unary();
    while (v != null && (peek() === '*' || peek() === '/' || peek() === '%')) {
      const op = tokens[pos++];
      const r = unary();
      if (r == null) return null;
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  const unary = (): number | null => {
    if (peek() === '-') { pos++; const v = unary(); return v == null ? null : -v; }
    if (peek() === '+') { pos++; return unary(); }
    return power();
  };
  const power = (): number | null => {
    const base = atom();
    if (base == null || peek() !== '^') return base;
    pos++;
    const exp = unary(); // right-associative
    return exp == null ? null : base ** exp;
  };
  const atom = (): number | null => {
    const t = tokens[pos++];
    if (t === undefined) return null;
    if (typeof t === 'number') return t;
    if (t === '(') {
      const v = sum();
      return tokens[pos++] === ')' ? v : null;
    }
    if (/^[\p{L}_]/u.test(t)) return vars.get(t) ?? null;
    return null;
  };

  const result = sum();
  return pos === tokens.length && result != null && Number.isFinite(result) ? result : null;
}

const TOKEN = /\s*(?:(\d+(?:[.,]\d+)?|[.,]\d+)|([\p{L}_][\p{L}\p{N}_]*)|([-+*/%^()]))/uy;

function tokenize(expr: string): (number | string)[] | null {
  const out: (number | string)[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < expr.length) {
    if (/^\s*$/.test(expr.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(expr);
    if (!m) return null;
    out.push(m[1] != null ? parseFloat(m[1].replace(',', '.')) : (m[2] ?? m[3]));
  }
  return out;
}
