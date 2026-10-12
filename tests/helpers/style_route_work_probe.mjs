import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
const { reviewViews: generatedViews } =
  await import("../../dist/review/views.js");
const before = generatedViews(
  input.before.entries.find(({ path }) => path === "home"),
)[0];
const after = generatedViews(
  input.after.entries.find(({ path }) => path === "home"),
)[0];
mock.module("../../dist/review/material_marker_offsets.js", {
  namedExports: {
    MaterialMarkerOffsets: class {
      constructor() {
        assert.fail("style route must not build fingerprint marker offsets");
      }
    },
  },
});
const real = await import("parse5");
let parses = 0;
function observe(source, options) {
  assert.equal(
    source,
    input.afterFiles.get(after.path),
    "only original head HTML may be parsed",
  );
  assert.equal(options.sourceCodeLocationInfo, true);
  parses++;
}
class CountedParser extends real.Parser {
  static parse(source, options) {
    observe(source, options);
    return super.parse(source, options);
  }
}
mock.module("parse5", {
  namedExports: {
    ...real,
    Parser: CountedParser,
    parse(source, options) {
      observe(source, options);
      return real.parse(source, options);
    },
  },
});
for (const [file, functions] of [
  [
    "components/comparison_projection",
    ["changedComponentImplementations", "projectComponentPair"],
  ],
  ["review/page_projection", ["projectAnalyzedPair"]],
  ["review/component_projection_resources", ["prepareComponentProjection"]],
]) {
  const url = `../../dist/${file}.js`;
  const exports = await import(url);
  mock.module(url, {
    namedExports: {
      ...exports,
      ...Object.fromEntries(
        functions.map((name) => [
          name,
          () => assert.fail(`style route called ${name}`),
        ]),
      ),
    },
  });
}
const { pageContext } = await import("./page_comparison.ts");
const { compareComponentView } =
  await import("../../dist/review/component_view.js");
const context = { ...pageContext(input), useFastPath: false };
context.resources.compare = () =>
  assert.fail("style route compared full materials/resources");
mock.method(crypto, "createHash", () =>
  assert.fail("style route must not compute a fingerprint or material hash"),
);
syncBuiltinESMExports();
const result = await compareComponentView(context, before, after);
assert.equal(result.comparisonPath, "style");
assert.equal(parses, 1);
process.stdout.write(JSON.stringify({ parses, path: result.comparisonPath }));
