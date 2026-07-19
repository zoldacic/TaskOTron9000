// Faithful port of the prototype's money formatters (Tasks.dc.html:619-620).
// Uses the U+2212 minus sign for negatives, like the prototype.

export function fmtMoney(n: number): string {
  return (n < 0 ? '−' : '+') +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtAbs(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
