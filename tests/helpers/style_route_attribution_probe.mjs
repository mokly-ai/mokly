import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
const real = await import("../../dist/review/css/inline_rule_matching.js");
let changed = 0;
let unchanged = 0;
mock.module("../../dist/review/css/inline_rule_matching.js", {
  namedExports: {
    ...real,
    attributeInlineRule(change, ...sides) {
      if (change.kind === "unchanged") unchanged++;
      else changed++;
      return real.attributeInlineRule(change, ...sides);
    },
  },
});
const { selectedStyleViews } = await import("./style_route.ts");
const { pageContext } = await import("./page_comparison.ts");
const { compareComponentView } =
  await import("../../dist/review/component_view.js");
const { before, after } = selectedStyleViews(input);
const result = await compareComponentView(pageContext(input), before, after);
assert.equal(result.comparisonPath, "complete");
process.stdout.write(JSON.stringify({ changed, unchanged }));
