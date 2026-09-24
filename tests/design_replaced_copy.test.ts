import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "parse5";

import { designCatalogue, textContent } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";
import {
  normalizeCopy,
  REPLACED_DESIGN_COPY,
} from "./helpers/replaced_copy.js";

test("the replaced-copy list names a contract and a replacement for each entry", () => {
  assert.ok(REPLACED_DESIGN_COPY.length > 0);
  assert.equal(
    new Set(REPLACED_DESIGN_COPY.map((replaced) => replaced.text)).size,
    REPLACED_DESIGN_COPY.length,
  );
  for (const replaced of REPLACED_DESIGN_COPY) {
    assert.match(replaced.contract, /^docs\/protocol\/[\w-]+\.md$/);
    assert.ok(replaced.instead.length > 0, replaced.text);
  }
});

test("no design entry renders copy a protocol replaced", async () => {
  const { outputs } = await designCatalogue;
  const designs = [...outputs].filter(
    ([route]) => route.startsWith("design/") && route.endsWith(".html"),
  );
  assert.ok(designs.length > 0);
  for (const [route] of designs) {
    const rendered = normalizeCopy(
      textContent(parse(textOutput(outputs, route)!)),
    );
    for (const replaced of REPLACED_DESIGN_COPY)
      assert.ok(
        !rendered.includes(normalizeCopy(replaced.text)),
        `${route} still renders "${replaced.text}"; ${replaced.contract} replaced it, so ${replaced.instead}`,
      );
  }
});
