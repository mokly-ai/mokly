import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { places } from "./write-failure-places";

/**
 * Each place of `write-failure-places.ts` draws the write-failure fragment of
 * `folio-chrome.md`. Each is rendered in Node with its own writes refused and
 * read for the fragment around each of its controls: the cause as one alert
 * line immediately above the control, the control reading what it reads once
 * refused, and Details with the request's reference beneath it, all in the
 * control's own `fo-write-failure` frame.
 *
 * Expo Router resolves to the press doubles and the resource hook to its
 * answer table, as in `server-render.ts`; the package Button stays the real
 * one, so the control is in the markup. The write, the session and the modal
 * frame resolve to `write-failure-doubles.ts`. The hooks belong to this
 * file's own test process.
 */
const pressDoubles = new URL("./press-doubles.ts", import.meta.url).href;
const resourceDoubles = new URL("./resource-doubles.ts", import.meta.url).href;
const doubles = new URL("./write-failure-doubles.ts", import.meta.url).href;
const doubled = ["/src/settings/write.ts", "/src/session/context.tsx"];
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-router")
      return { url: pressDoubles, shortCircuit: true };
    if (specifier === "@firna/ui/modal")
      return { url: doubles, shortCircuit: true };
    const resolved = next(specifier, context);
    if (resolved.url.endsWith("/src/data/use-resource.ts"))
      return { url: resourceDoubles, shortCircuit: true };
    if (
      context.parentURL !== doubles &&
      doubled.some((path) => resolved.url.endsWith(path))
    )
      return { url: doubles, shortCircuit: true };
    return resolved;
  },
});

const theme = paletteUiTheme("light");
const frameOpen = '<div class="fo-write-failure">';

/** Where each `fo-write-failure` frame of the markup starts and ends. */
function frames(html: string): { start: number; end: number }[] {
  const found: { start: number; end: number }[] = [];
  for (let start = html.indexOf(frameOpen); start >= 0;) {
    const tags = /<div\b|<\/div>/g;
    tags.lastIndex = start;
    let depth = 0;
    for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[0] === "</div>" ? -1 : 1;
      if (depth === 0) {
        found.push({ start, end: tags.lastIndex });
        break;
      }
    }
    start = html.indexOf(frameOpen, start + 1);
  }
  return found;
}

/**
 * What the innermost frame around one control holds, in document order: each
 * cause, the control with its label, and each Details with its reference.
 */
function failureAround(html: string, control: string): string[] {
  const at = html.indexOf(`data-testid="${control}"`);
  if (at < 0) return ["control not drawn"];
  const frame = frames(html)
    .filter(({ start, end }) => start < at && at < end)
    .at(-1);
  if (frame === undefined) return ["no fo-write-failure frame"];
  const inside = html.slice(frame.start, frame.end);
  const parts = new RegExp(
    '<p class="fo-copy" role="alert">([^<]*)</p>' +
      `|<button [^>]*data-testid="${control}"[^>]*>(?:(?!</button>)[\\s\\S])*?<div class="firna-text"[^>]*>([^<]*)</div>` +
      '|<details class="fo-error-details"><summary>Details</summary>[\\s\\S]*?<code[^>]*>([^<]*)</code>',
    "g",
  );
  return [...inside.matchAll(parts)].map(([, cause, label, reference]) =>
    cause !== undefined
      ? "cause: " + cause
      : label !== undefined
        ? "control: " + label
        : "details: " + reference,
  );
}

for (const place of places) {
  test(`${place.name} draws its cause above the control and Details beneath`, async () => {
    const html = renderToStaticMarkup(
      createElement(SharedUiThemeProvider, {
        theme,
        children: await place.screen(),
      }),
    );
    for (const [control, label] of Object.entries(place.controls)) {
      assert.deepEqual(
        failureAround(html, control),
        [
          "cause: Mokly is busy. Try again in a moment.",
          "control: " + label,
          "details: req_write_failure_places",
        ],
        `${place.name}: ${control}`,
      );
    }
  });
}
