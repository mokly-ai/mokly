import type { ColorScheme } from "@mokly/viewer";

import { escapeHtml } from "./markdown.js";

/** A package-owned complete document; no consumer renderer or scripts participate. */
export function documentTemplate(
  title: string,
  body: string,
  scheme: ColorScheme,
): string {
  return `<!doctype html>
<html lang="en" style="color-scheme: ${scheme}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${documentStyles(scheme)}</style></head>
<body><main>${body}</main></body></html>\n`;
}

/**
 * The shell's Markdown typography and palette, as the document design in
 * `design/browse/pages/document` depicts them. Elements the design does not
 * show, such as `h3`, code blocks, and quotes, follow the same scale.
 */
function documentStyles(scheme: ColorScheme): string {
  const dark = scheme === "dark";
  return `
:root { --surface: ${dark ? "#221f1b" : "#ffffff"}; --text: ${dark ? "#f0ece4" : "#1a1d1c"}; --muted: ${dark ? "#b2aba0" : "#676e6a"}; --border: ${dark ? "#302d28" : "#e3e5e0"}; --soft: ${dark ? "#161512" : "#f4f4f1"}; --link: ${dark ? "#a5cdb6" : "#2a4733"}; }
* { box-sizing: border-box; }
body { margin: 0; padding: 36px 44px 44px; background: var(--surface); color: var(--text); font: 14.5px/1.65 "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
main { max-width: 720px; margin: 0 auto; }
h1, h2, h3, h4, h5, h6 { line-height: 1.35; letter-spacing: -.01em; margin: 28px 0 8px; scroll-margin-top: 24px; }
h1 { font-size: 26px; line-height: 1.25; letter-spacing: -.015em; margin: 0 0 12px; }
h2 { font-size: 17px; } h3 { font-size: 15px; margin-top: 22px; } h4, h5, h6 { font-size: 14.5px; margin-top: 22px; }
main > :first-child { margin-top: 0; }
p, ul, ol, pre, blockquote, table { margin: 0 0 14px; }
ul, ol { padding-left: 22px; } li + li { margin-top: 4px; }
a { color: var(--link); font-weight: 600; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; }
img { max-width: 100%; height: auto; }
code, pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 12.5px; background: var(--soft); border: 1px solid var(--border); border-radius: 5px; }
code { padding: 1px 5px; } pre { padding: 12px 16px; overflow-x: auto; } pre code { padding: 0; border: 0; background: none; font-size: inherit; }
blockquote { margin-inline: 0; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); background: var(--soft); }
blockquote > :last-child { margin-bottom: 0; }
table { border-collapse: collapse; font-size: 13.5px; width: 100%; }
th, td { padding: 7px 12px; border: 1px solid var(--border); text-align: left; vertical-align: top; } th { background: var(--soft); font-weight: 650; }
hr { border: 0; border-top: 1px solid var(--border); margin: 24px 0; }
input[type="checkbox"] { accent-color: var(--link); margin-right: 6px; }
@media (max-width: 600px) { body { font-size: 14px; padding: 22px 18px 28px; } h1 { font-size: 22px; } }
`;
}
