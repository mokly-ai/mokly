import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { test } from "node:test";

import { domBackendCss } from "@firna/ui";
import { tokenCss } from "@mokly-cloud/tokens/token-css";
import { parse } from "parse5";

import { catalogueEntries } from "./catalogue-index";
import { screenFile, screenView, stylesheetPath } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import { authoredPath, viewPalette } from "./catalogue-reads";
import {
  attribute,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";

/** One generated document, with its head and its body as markup. */
function generated(
  path: string,
  viewport: Viewport,
  scheme: Scheme = "light",
): { html: string; head: string; body: string } {
  const html = readFileSync(screenFile(path, viewport, scheme), "utf8");
  const end = html.indexOf("</head>");
  return {
    html,
    head: html.slice(html.indexOf("<head>"), end),
    body: html.slice(end),
  };
}

/** The `href` of one configured stylesheet, relative to one document. */
function linked(path: string, viewport: Viewport, sheet: string): string {
  return relative(
    dirname(screenView(path, viewport)),
    stylesheetPath(authoredPath("styles/" + sheet)),
  );
}

test("document titles preserve the screen name", () => {
  const path = "product/viewer/standalone/build/unreadable";
  const entry = catalogueEntries().find((record) => record.path === path);
  assert.equal(entry?.title, "Build · Couldn’t load");
  for (const scheme of ["light", "dark"] as const) {
    const { html } = generated(path, "desktop", scheme);
    assert.ok(
      html.startsWith(
        '<!doctype html><html style="color-scheme: ' + scheme + '"><head>',
      ),
      scheme,
    );
    const titles = elements(
      parse(html),
      (element) => element.tagName === "title",
    );
    assert.deepEqual(titles.map(label), [entry.title], scheme);
  }
});

test("static documents carry the React Native Web atomic stylesheet", () => {
  const { head, body } = generated("product/settings/github/menu", "desktop");
  const links = head.indexOf('<link rel="stylesheet"');
  assert.ok(links > 0);
  const group = head.indexOf('[stylesheet-group="0"]');
  assert.ok(group > 0 && group < links);
  const atomic = new Set(
    [...body.matchAll(/ class="([^"]*)"/g)]
      .flatMap((match) => match[1].split(" "))
      .filter((name) => /^(?:css|r)-[\w-]+$/.test(name)),
  );
  assert.ok(atomic.size > 0);
  for (const name of atomic) {
    const rule = head.indexOf("." + name + "{");
    assert.ok(rule > 0 && rule < links, name);
  }
});

test("static documents keep the theme boundary inside the wrapper and emit Firna CSS first", () => {
  for (const [path, viewport, scheme, palette] of [
    ["product/settings/tokens", "desktop", "light", undefined],
    ["product/viewer/standalone", "mobile", "dark", undefined],
    ["design/tokens", "mobile", "dark", undefined],
    [
      "design/button/primary",
      "desktop",
      "dark",
      "paper-scope component-document",
    ],
  ] as const) {
    const id = [path, viewport, scheme].join(" ");
    const { html, head } = generated(path, viewport, scheme);
    const document = parse(html);
    const [body] = elements(document, (element) => element.tagName === "body");
    assert.ok(body, id);
    const [wrapper, ...others] = childElements(body);
    assert.deepEqual(others, [], id);
    assert.ok(wrapper, id);
    assert.equal(attribute(wrapper, "lang"), "en", id);
    assert.equal(attribute(wrapper, "data-color-scheme"), scheme, id);
    assert.equal(attribute(wrapper, "data-viewport"), viewport, id);
    assert.equal(attribute(wrapper, "class"), palette, id);
    const [boundary, ...rest] = childElements(wrapper);
    assert.deepEqual(rest, [], id);
    assert.ok(boundary, id);
    assert.match(attribute(boundary, "style") ?? "", /^display:contents;/, id);
    assert.equal(
      elements(body, (element) => element.tagName === "style").length,
      0,
      id,
    );
    const firnaCss = head.indexOf(domBackendCss);
    const tokens = head.indexOf(tokenCss(scheme, viewport));
    assert.ok(firnaCss > 0, id);
    assert.ok(firnaCss < tokens, id);
    assert.ok(tokens < head.indexOf(linked(path, viewport, "base.css")), id);
  }
});

test("every document's wrapper uses paper for components and default Canvas for screens", () => {
  for (const record of catalogueEntries()) {
    if (record.kind !== "screen" && record.kind !== "component") continue;
    const palette = record.kind === "component" ? "paper" : "default";
    for (const { viewport, colorScheme } of record.views)
      assert.equal(
        viewPalette(record.path, viewport, colorScheme),
        palette,
        [record.path, viewport, colorScheme].join(" "),
      );
  }
});

test("product documents include the Folio area stylesheets", () => {
  const path = "product/account/project-created";
  const { head } = generated(path, "desktop");
  for (const sheet of ["folio", "chrome", "inventory"])
    assert.ok(
      head.includes(
        'href="' + linked(path, "desktop", "product/" + sheet + ".css") + '"',
      ),
      sheet + " stylesheet must be linked",
    );
});

test("settings documents reuse the same product stylesheets", () => {
  const path = "product/settings/tokens";
  const { head, body } = generated(path, "desktop");
  assert.ok(
    head.includes(
      'href="' + linked(path, "desktop", "product/inventory.css") + '"',
    ),
  );
  assert.ok(body.includes("fo-dialog"));
});

test("a saved variant's document carries its own title", () => {
  const entry = catalogueEntries().find(
    (record) => record.path === "design/button/primary",
  );
  assert.equal(entry?.title, "Primary");
  for (const scheme of ["light", "dark"] as const) {
    const { html } = generated("design/button/primary", "mobile", scheme);
    const document = parse(html);
    for (const tag of ["title", "h1"])
      assert.deepEqual(
        elements(document, (element) => element.tagName === tag).map(label),
        [entry.title],
        scheme + " " + tag,
      );
  }
});
