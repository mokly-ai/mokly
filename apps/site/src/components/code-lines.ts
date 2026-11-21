/**
 * The lines that `CodePanel.astro` draws: each line is its syntax tokens in
 * order, so a page writes its code once, already highlighted, and the panel
 * needs no highlighter at build time. A page types its lines with these, as
 * `const SOURCE: readonly CodeLine[] = [[["keyword", "import"], " { x }"]]`.
 */

/** The syntax role of one token, which picks its colour. */
export type CodeTokenKind =
  "attr" | "fn" | "keyword" | "number" | "punct" | "string" | "type";

/** One token of a line: plain text, or text with its syntax role. */
export type CodeToken = string | readonly [CodeTokenKind, string];

/** One line of code, as its tokens in order. */
export type CodeLine = readonly CodeToken[];
