import assert from "node:assert/strict";
import { test } from "node:test";

import {
  designCatalogue,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";
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
  const { manifest } = await designCatalogue;
  const designs = manifest.entries.filter(
    (entry) => entry.kind === "screen" && entry.id.startsWith("design-"),
  );
  assert.ok(designs.length > 0);
  for (const entry of designs)
    for (const viewport of ["mobile", "desktop"] as const) {
      const { document } = await designDocument(entry.id, viewport);
      const rendered = normalizeCopy(textContent(document));
      for (const replaced of REPLACED_DESIGN_COPY)
        assert.ok(
          !rendered.includes(normalizeCopy(replaced.text)),
          `${entry.id} (${viewport}) still renders "${replaced.text}"; ${replaced.contract} replaced it, so ${replaced.instead}`,
        );
    }
});
