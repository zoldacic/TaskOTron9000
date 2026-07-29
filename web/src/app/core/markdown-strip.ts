/**
 * Removes markdown decoration from assistant answers.
 *
 * Answers are rendered as plain text, deliberately — nothing the model writes is
 * ever treated as markup, so there is no injection surface. But the model still
 * reaches for `**bold**` now and then, which shows up as literal asterisks. This
 * strips the decoration without turning the text into markup.
 *
 * Only *paired* markers are stripped. Single `*` and `_` — markdown's italics —
 * are left alone on purpose: imported merchant names are full of them
 * ("K*COOP.SE", "Surf*alhems", "Zettle_*raddningstjansten"), and stripping them
 * would corrupt the very titles the answer is quoting. Bold is the common case
 * and its doubled markers can't collide with those names.
 *
 * Applied at render time on the whole accumulated answer, not per streamed
 * chunk, so a marker split across two chunks still resolves.
 */
export function stripMarkdown(text: string): string {
  return text
    // [label](url) -> label (url)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    // leading heading hashes
    .replace(/^#{1,6}[ \t]+/gm, '')
    // **bold** and __bold__
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replace(/__([^\n]+?)__/g, '$1')
    // ~~strikethrough~~
    .replace(/~~([^\n]+?)~~/g, '$1')
    // `inline code` — backticks never appear in imported titles
    .replace(/`([^`\n]+)`/g, '$1');
}
