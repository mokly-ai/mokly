import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  textContent,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

const DOCUMENT = "design/browse/appearance/states/light-only-document";

test("a removed light-only document keeps a light pane and names its fallback under Dark", async () => {
  const { outputs } = await designCatalogue;
  for (const viewport of ["mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const where = `${viewport} ${scheme}`;
      const html = textOutput(outputs, viewRoute(DOCUMENT, viewport, scheme));
      assert.ok(html, `${where}: generated`);
      const document = parse(html);
      const [label] = byClass(document, "mbk-previous");
      assert.ok(label, `${where}: previous-version label`);
      assert.equal(
        textContent(label).replace(/\s+/gu, " ").trim(),
        scheme === "dark"
          ? "Showing previous version — Light only"
          : "Showing previous version",
        `${where}: label`,
      );
      const [pane] = byClass(document, "mbk-doc-pane");
      assert.ok(pane, `${where}: document pane`);
      assert.equal(
        attribute(pane, "data-mbk-light-only"),
        "",
        `${where}: the pane keeps the Light palette`,
      );
      const [markdown] = byClass(pane, "mbk-markdown");
      assert.ok(markdown, `${where}: shell typography`);
      assert.match(textContent(markdown), /^\s*Payment terms/u, where);
    }
});
