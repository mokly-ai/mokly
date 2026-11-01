import "./dom.js";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LightOnlyBand,
  LightOnlyNote,
} from "../src/scheme-fallback/scheme-fallback.js";

test("the note names the fallback, with a dash as the suffix of a label", () => {
  assert.equal(
    renderToStaticMarkup(<LightOnlyNote />),
    '<span class="mbk-frame-scheme-note mbk-reset">Light only</span>',
  );
  assert.equal(
    renderToStaticMarkup(<LightOnlyNote suffix />),
    '<span class="mbk-frame-scheme-note mbk-reset"> — Light only</span>',
  );
});

test("the band above a current document carries the fallback mark and the note", () => {
  assert.equal(
    renderToStaticMarkup(<LightOnlyBand />),
    '<p class="mbk-previous mbk-scheme-fallback mbk-reset" data-color-scheme-fallback=""><span class="mbk-frame-scheme-note mbk-reset">Light only</span></p>',
  );
  render(<LightOnlyBand />);
  assert.equal(screen.getByText("Light only").tagName, "SPAN");
});

/** Package stylesheets, their spaces folded. */
async function stylesheets(...names: string[]): Promise<string> {
  const sheets = await Promise.all(
    names.map((name) =>
      fs.readFile(
        new URL(`../src/${name}/${name}.css`, import.meta.url),
        "utf8",
      ),
    ),
  );
  return sheets.join("\n").replace(/\s+/gu, " ");
}

test("the stylesheet names a document's fallback only under Dark", async () => {
  // The band's rules live with the band, and the rule that reveals the note
  // in any previous-version band lives with that band.
  const css = await stylesheets("scheme-fallback", "previous-version");
  const dark = '.mbk[data-mokly-color-scheme="dark"]';
  for (const rule of [
    ".mbk-previous.mbk-scheme-fallback { display: none; }",
    `${dark} .mbk-previous.mbk-scheme-fallback { display: block; }`,
    `${dark} .mbk-previous[data-color-scheme-fallback] .mbk-frame-scheme-note { display: inline; }`,
  ])
    assert.ok(css.includes(rule), rule);
});
