import { renderToStaticMarkup } from "#markup-renderer";
import type { ReactNode } from "react";

import { DisplaySelection } from "./display_context.js";
import { defaultSelection, selectionQuery } from "./selection.js";
import type { ViewerSelection } from "./types.js";

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
/** React produces inert island markup; the runtime subsequently owns its DOM. */
export function islandMarkup(
  node: ReactNode,
  baseUrl: URL,
  selection: ViewerSelection = defaultSelection,
): string {
  return renderToStaticMarkup(
    <DisplaySelection value={selection}>{node}</DisplaySelection>,
  )
    .replace(
      /\b(href|src)="(\/(?:static\/|view\/|id\/)[^"]*|\/)"/g,
      (_, attribute: string, relative: string) =>
        `${attribute}="${baseUrl.origin}${relative}"`,
    )
    .replace(/<input\b[^>]*data-mokly-search[^>]*>/g, (tag) =>
      tag
        .replace(/\svalue="[^"]*"/, "")
        .replace(/\/?\s*>$/, ` value="${escape(selectionQuery(selection))}"/>`),
    )
    .replace(/<button\b[^>]*>/g, (tag) => {
      const filter = tag.match(/data-filter="([^"]+)"/)?.[1];
      const viewport = tag.match(/data-viewport-option="([^"]+)"/)?.[1];
      const scheme = tag.match(/data-color-scheme-option="([^"]+)"/)?.[1];
      const pressed = filter
        ? filter === (selection.view === "changes" ? "changed" : "all")
        : viewport
          ? viewport === selection.viewport
          : scheme
            ? scheme === selection.colorScheme
            : tag.includes("data-workspace-scheme")
              ? selection.colorScheme === "dark"
              : undefined;
      return pressed === undefined
        ? tag
        : tag.replace(/aria-pressed="[^"]*"/, `aria-pressed="${pressed}"`);
    })
    .replace(
      /<select\b[^>]*data-workspace-viewport[^>]*>[\s\S]*?<\/select>/g,
      (html) =>
        html.replace(/<option\b[^>]*>/g, (tag) => {
          const cleaned = tag.replace(/ selected=""/g, "");
          return tag.includes(`value="${selection.viewport}"`)
            ? cleaned.replace(/>$/, ' selected="">')
            : cleaned;
        }),
    );
}
