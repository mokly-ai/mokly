import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  byClass,
  designCatalogue,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

/** A depicted navigation row whose icon is a folder. */
function folderRows(html: string): Element[] {
  return byClass(parse(html), "mbk-nav-row").filter((row) =>
    byClass(row, "mbk-nav-ico").some((icon) =>
      (icon.attrs.find((item) => item.name === "class")?.value ?? "")
        .split(/\s+/u)
        .includes("folder"),
    ),
  );
}

test("every depicted folder row shows the count of its rows, also while it is closed", async () => {
  const { outputs } = await designCatalogue;
  let checked = 0;
  const missing: string[] = [];
  for (const route of [...outputs.keys()].sort()) {
    if (!route.endsWith(".html")) continue;
    const html = textOutput(outputs, route);
    if (html === undefined) continue;
    for (const row of folderRows(html)) {
      checked += 1;
      const label = textContent(byClass(row, "mbk-nav-label")[0] ?? row);
      const counts = byClass(row, "mbk-nav-count").map((count) =>
        textContent(count).trim(),
      );
      if (counts.length !== 1 || !/^[1-9]\d*$/u.test(counts[0]!))
        missing.push(`${route}: ${label.trim()}`);
    }
  }
  assert.ok(checked > 500, `only ${checked} folder rows were checked`);
  assert.deepEqual(missing, []);
});
