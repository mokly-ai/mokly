/**
 * The inline Markdown a release note may contain. Release notes are written
 * by the release tool, so only links and code spans appear; everything else
 * is text. Parsing them into typed segments keeps the rendered page free of
 * raw markup and keeps every link destination checked.
 */

/** One piece of a release note. */
export type NoteSegment =
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "link"; readonly href: string; readonly text: string }
  | { readonly kind: "strong"; readonly value: string }
  | { readonly kind: "text"; readonly value: string };

const INLINE = /\[([^\]]*)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;

/** A destination the site is willing to publish from a release note. */
function href(value: string): string | undefined {
  if (value.startsWith("/") || value.startsWith("#")) return value;
  return /^https?:\/\//i.test(value) ? value : undefined;
}

/**
 * Split one note into text, links and code spans. A link with an
 * unpublishable destination keeps its text and loses the link, so a malformed
 * entry never becomes a dead or dangerous reference.
 */
export function parseNote(markdown: string): readonly NoteSegment[] {
  const segments: NoteSegment[] = [];
  let index = 0;
  const push = (value: string): void => {
    if (value.length > 0) segments.push({ kind: "text", value });
  };
  for (const match of markdown.matchAll(INLINE)) {
    const start = match.index;
    push(markdown.slice(index, start));
    index = start + match[0].length;
    const [, text, target, code, strong] = match;
    if (code !== undefined) {
      segments.push({ kind: "code", value: code });
      continue;
    }
    if (strong !== undefined) {
      segments.push({ kind: "strong", value: strong });
      continue;
    }
    const destination = href(target ?? "");
    if (destination === undefined) push(text ?? "");
    else segments.push({ href: destination, kind: "link", text: text ?? "" });
  }
  push(markdown.slice(index));
  return segments;
}

/** The note as plain text, for the feed and for accessible summaries. */
export function noteText(segments: readonly NoteSegment[]): string {
  return segments
    .map((segment) => (segment.kind === "link" ? segment.text : segment.value))
    .join("");
}
