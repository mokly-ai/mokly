import { Marked, type Token, type Tokens } from "marked";
import { parseFragment } from "parse5";

/** Destination rewrites are supplied by the confined repository reader. */
export type DocumentDestination = (
  value: string,
  image: boolean,
) => string | null;

/** Pure Markdown output plus the evidence required by titles and link validation. */
export interface RenderedMarkdown {
  html: string;
  title?: string;
  headings: readonly string[];
  destinations: readonly { value: string; image: boolean }[];
}

/** Render a fresh CommonMark/GFM token tree; raw HTML is always literal text. */
export function renderMarkdown(
  source: string,
  resolve: DocumentDestination = (value) => value,
): RenderedMarkdown {
  const headings: string[] = [];
  const used = new Set<string>();
  const destinations: { value: string; image: boolean }[] = [];
  let title: string | undefined;
  const marked = new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      html: ({ text }) => escapeHtml(text),
      heading({ tokens, depth }) {
        const text = headingText(tokens);
        title ??= text;
        const base = text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
          .replace(/\s/g, "-");
        let id = base;
        let repeat = 2;
        while (used.has(id)) id = `${base}-${repeat++}`;
        used.add(id);
        headings.push(id);
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link(token) {
        destinations.push({ value: token.href, image: false });
        const href = resolve(token.href, false);
        const text = this.parser.parseInline(token.tokens);
        return href === null
          ? text
          : `<a href="${escapeHtml(href)}"${titleAttribute(token.title)}>${text}</a>`;
      },
      image(token: Tokens.Image) {
        destinations.push({ value: token.href, image: true });
        const href = resolve(token.href, true);
        const alt = headingText(token.tokens);
        return href === null
          ? escapeHtml(alt)
          : href.startsWith("mock:")
            ? `<a href="${escapeHtml(href)}">${escapeHtml(alt)}</a>`
            : `<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"${titleAttribute(token.title)}>`;
      },
    },
  });
  const html = marked.parse(source, { async: false });
  return {
    html,
    ...(title === undefined ? {} : { title }),
    headings,
    destinations,
  };
}

/** Escape both element text and double-quoted attributes without trusting Markdown. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleAttribute(title: string | null | undefined): string {
  return title ? ` title="${escapeHtml(title)}"` : "";
}

function headingText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if ("tokens" in token && token.tokens) return headingText(token.tokens);
      if (token.type === "codespan" || token.type === "html") return token.text;
      if ("text" in token) return decodeText(token.text);
      return token.type === "br" ? " " : "";
    })
    .join("");
}

function decodeText(raw: string): string {
  const fragment = parseFragment(
    raw.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );
  return fragment.childNodes
    .map((node) => ("value" in node ? node.value : ""))
    .join("");
}
