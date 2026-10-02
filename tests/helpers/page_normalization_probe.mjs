import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
const scenario = process.argv[3];
const real = await import("../../dist/review/ignore.js");
const { generatedViews } =
  await import("../../packages/viewer/dist/components/views.js");
const after = generatedViews(
  input.after.entries.find(({ id }) => id === "home"),
)[0];
const before = generatedViews(
  input.before.entries.find(({ id }) => id === "home"),
).find(({ path }) => path === after.path);
const base = input.beforeFiles.get(before.path);
const head = input.afterFiles.get(after.path);
let calls = 0;
mock.module("../../dist/review/ignore.js", {
  namedExports: {
    ...real,
    normalizeReviewPair(left, right, route) {
      if (scenario === "pair" && left === base && right === head) calls++;
      return real.normalizeReviewPair(left, right, route);
    },
    normalizeSingleDocument(...args) {
      if (scenario === "one-sided") calls++;
      return real.normalizeSingleDocument(...args);
    },
  },
});
const { pageContext } = await import("./page_comparison.ts");
const { compareComponentView } =
  await import("../../dist/review/component_view.js");
const result = await compareComponentView(
  pageContext(input),
  scenario === "pair" ? before : undefined,
  after,
);
assert.equal(result.comparisonPath, "complete");
process.stdout.write(JSON.stringify({ calls }));
