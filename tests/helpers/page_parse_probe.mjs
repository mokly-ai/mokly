import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

const real = await import("parse5");
const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
const originals = new Set([
  ...input.beforeFiles.values(),
  ...input.afterFiles.values(),
]);
let parses = 0;
function observe(source, options) {
  assert.ok(
    originals.has(source),
    "classification parsed rewritten or normalized page HTML",
  );
  assert.equal(options?.sourceCodeLocationInfo, true);
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
const { comparePageFixture } = await import("./page_comparison.ts");
const results = await comparePageFixture(input);
const complete = results.filter(
  ({ comparisonPath }) => comparisonPath === "complete",
).length;
assert.equal(parses, results.length + complete);
process.stdout.write(
  JSON.stringify({ parses, views: results.length, complete }),
);
