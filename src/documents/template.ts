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

function documentStyles(scheme: ColorScheme): string {
  const dark = scheme === "dark";
  return `
:root { --surface: ${dark ? "#221f1b" : "#ffffff"}; --text: ${dark ? "#f0ece4" : "#1a1d1c"}; --muted: ${dark ? "#b2aba0" : "#676e6a"}; --border: ${dark ? "#302d28" : "#e3e5e0"}; --soft: ${dark ? "#1c1b17" : "#f4f6f3"}; --link: ${dark ? "#a5cdb6" : "#2a4733"}; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text); font: 16px/1.7 "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
main { max-width: 820px; margin: auto; padding: 32px 28px 64px; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.7em 0 .65em; letter-spacing: -.02em; scroll-margin-top: 24px; }
h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.2em; }
main > :first-child { margin-top: 0; }
p, ul, ol, pre, blockquote, table { margin: 0 0 1.2em; }
a { color: var(--link); text-underline-offset: 3px; }
a:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; }
img { max-width: 100%; height: auto; }
code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .9em; background: var(--soft); border-radius: 6px; }
code { padding: .15em .35em; } pre { padding: 16px; overflow-x: auto; } pre code { padding: 0; font-size: 1em; }
blockquote { margin-inline: 0; padding: 16px 20px; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); background: var(--soft); }
blockquote > :last-child { margin-bottom: 0; }
table { display: block; overflow-x: auto; border-collapse: collapse; }
th, td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; } th { background: var(--soft); }
hr { border: 0; border-top: 1px solid var(--border); margin: 28px 0; }
input[type="checkbox"] { accent-color: var(--link); margin-right: 6px; }
@media (max-width: 600px) { main { padding: 24px 18px 48px; } }
`;
}
