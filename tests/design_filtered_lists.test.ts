import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "parse5";

import { viewRoute } from "../packages/viewer/src/navigation/routes.js";

import {
  attribute,
  byClass,
  designCatalogue,
  textContent,
} from "./helpers/design_catalogue.js";
import { variantToggles } from "./helpers/design_rows.js";
import { textOutput } from "./helpers/generated_text.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: filtered mockups disclose only lists with matching rows`, async () => {
    const compilation = await designCatalogue;
    let checked = 0;
    for (const entry of compilation.manifest.entries) {
      if (entry.kind !== "screen" || !entry.path.startsWith("design/"))
        continue;
      const html = textOutput(
        compilation.outputs,
        viewRoute(entry.path, viewport, "light"),
      );
      assert.ok(html, entry.path);
      const document = parse(html);
      const changedOnly = byClass(document, "mbk-nav-filter-opt").some(
        (node) =>
          attribute(node, "class")?.includes("active") &&
          textContent(node).startsWith("Changes"),
      );
      if (!changedOnly && byClass(document, "mbk-search-value").length === 0)
        continue;
      checked += 1;
      for (const section of byClass(document, "mbk-nav-section")) {
        const rows = byClass(section, "mbk-nav-row");
        for (const leaf of byClass(section, "mbk-nav-leaf")) {
          const row = byClass(leaf, "mbk-nav-row")[0]!;
          const toggle = variantToggles(leaf)[0]!;
          const next = rows[rows.indexOf(row) + 1];
          const inset = (node: typeof row) =>
            Number(attribute(node, "style")?.match(/padding-left:(\d+)/)?.[1]);
          const label: string = `${entry.path}: ${attribute(toggle, "aria-label")}`;
          assert.equal(attribute(toggle, "aria-expanded"), "true", label);
          assert.ok(next && inset(next) > inset(row), label);
        }
      }
    }
    assert.ok(checked > 0, "cover the Changes and search mockup families");
  });
}
