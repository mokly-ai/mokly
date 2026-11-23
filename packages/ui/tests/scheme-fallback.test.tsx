import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { LightOnlyNote } from "../src/scheme-fallback/scheme-fallback.js";

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
