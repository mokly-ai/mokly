import assert from "node:assert/strict";

import { parse } from "parse5";

import { attributeInlineRules } from "../../src/review/css/inline_attribution.js";
import { parseInlineRuns } from "../../src/review/css/inline_rule_runs.js";
import { CssResourceAnalysis } from "../../src/review/css/resource_analysis.js";

const [entrypoint, kind, mode] = process.argv.slice(2);
const cache = new CssResourceAnalysis(
  undefined,
  undefined,
  mode === "zero" ? 0 : undefined,
);
const collect = () => {
  for (let attempt = 0; attempt < 4; attempt++) global.gc();
  return process.memoryUsage().heapUsed;
};
const baseline = collect();
const populated = populate();
const retained = collect();
process.stdout.write(
  JSON.stringify({
    allocatedBytes: populated - baseline,
    releasedBytes: populated - retained,
    retainedBytes: retained - baseline,
  }),
);

function populate() {
  const filler = "你".repeat(1024);
  const style =
    kind === "invalid"
      ? `.a{--value:${filler};broken}`
      : kind === "fallback"
        ? `@import "theme.css";.a{--value:${filler}}`
        : `.a{--value:${filler};color:red}`;
  const small = `<!doctype html><html><head><style>${style}</style></head><body><main class="a"></main></body></html>`;
  const parent = small + "你".repeat(24 * 1024 * 1024);
  assert.equal(parent.charCodeAt(parent.length - 1), "你".charCodeAt(0));
  const source = parent.slice(0, small.length);
  const start = source.indexOf("<style>");
  const end = source.indexOf("</style>") + 8;
  const text = source.slice(start + 7, end - 8);
  if (entrypoint === "list") {
    const spans = [{ start, end, source: source.slice(start, end), text }];
    const result = parseInlineRuns(spans, cache.parser);
    assert.equal(result.status, kind === "invalid" ? "unresolved" : "parsed");
    if (kind === "segment") {
      const warmed = parseInlineRuns(spans, cache.parser);
      assert.deepEqual(warmed, result);
    }
  } else {
    const usage = {
      viewport: "mobile",
      colorScheme: "light",
      instances: [],
      slots: [],
      ranges: [],
    };
    const after = small
      .replace("color:red", "color:blue")
      .replace("broken}", "otherBroken}")
      .replace("theme.css", "other.css");
    const analyze = () =>
      attributeInlineRules({
        before: { source, sourceRanges: [], usage },
        after: { source: after, sourceRanges: [], usage },
        pairedIgnoreIds: [],
        parser: cache.parser,
        prepare: () => ({
          before: { document: parse(source), ranges: [] },
          after: { document: parse(after), ranges: [] },
        }),
      });
    const result = analyze();
    assert.equal(result.status, kind === "invalid" ? "unresolved" : "resolved");
    if (kind === "segment") assert.deepEqual(analyze(), result);
  }
  const used = collect();
  assert.ok(parent.length > 24 * 1024 * 1024);
  return used;
}
