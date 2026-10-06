import { renderToStaticMarkup } from "react-dom/server";

import { serializeReviewSentinels } from "./sentinels.js";
import type { RenderInput } from "./types.js";

/** Render a screen as a neutral, complete static HTML document. */
export default function render(input: RenderInput): string {
  const links = input.stylesheets
    .map((href) => `<link rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join("");
  const body = serializeReviewSentinels(renderToStaticMarkup(input.node));
  return [
    "<!doctype html>",
    `<html lang="en"><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(input.entry.title)}</title>${links}</head>`,
    `<body data-mokly-viewport="${input.viewport}">${body}</body></html>\n`,
  ].join("");
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeText(value: string): string {
  return escapeAttribute(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
