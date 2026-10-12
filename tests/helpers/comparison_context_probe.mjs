import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
let production = 0;
let oracle = 0;
for (const [module, legacy] of [
  ["../../dist/review/component_view.js", false],
  ["./page_m6/component_view.js", true],
]) {
  const original = await import(module);
  mock.module(module, {
    namedExports: {
      ...original,
      async compareComponentView(context, before, after) {
        if (legacy) {
          assert.equal(context.links, undefined, "M6 cannot use modern links");
          oracle++;
        } else {
          assert.equal(typeof context.links, "function", "production links");
          const links = context.links(before.path, after.path);
          assert.equal(links.equalSource, true);
          assert.equal(typeof links.before, "function");
          assert.equal(typeof links.after, "function");
          production++;
        }
        return { comparisonPath: "fast" };
      },
    },
  });
}
const { comparePageViews, pageContext } = await import("./page_comparison.ts");
const { assertComparisonPaths } =
  await import("./component_comparison_paths.ts");
await comparePageViews(input);
await assertComparisonPaths(input, "fast");
await comparePageViews(input, true);
assert.equal(pageContext(input, true, "page_m6").links, undefined);
assert.ok(oracle > 0);
assert.equal(production, oracle * 2);
process.stdout.write(JSON.stringify({ production, oracle }));
