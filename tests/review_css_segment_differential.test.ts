import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { findUnownedInlineStyles } from "../src/review/css/inline_styles.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { parseSnapshot, segmentOracle } from "./helpers/css_segments.js";
import { parseInlineRuleList } from "./helpers/inline_parse.js";

test("segment assembly equals every delivered CSS parser input", async () => {
  const corpus = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/css/parse-inputs.json", import.meta.url),
      "utf8",
    ),
  ) as { inputs: string[]; sourceTests: string[] };
  assert.equal(corpus.inputs.length, 334);
  assert.equal(corpus.sourceTests.length, 24);
  for (const bound of [undefined, 0]) {
    const compare = segmentOracle(bound);
    for (const [index, source] of corpus.inputs.entries())
      compare(source, `delivered corpus ${index}, cache ${bound}`);
  }
});

test("real React Native Web cumulative sheets equal whole parses", async (context) => {
  const root = await fs.mkdtemp(path.resolve(".context/m4-rnw-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, {
    areas: 1,
    screens: 2,
    rows: 1,
    inlineStyles: true,
  });
  const compilation = await compileCatalogue(await loadConfig(root));
  const compare = segmentOracle();
  let elements = 0;
  let rules = 0;
  for (const source of compilation.outputs.values()) {
    for (const span of findUnownedInlineStyles(source, [], new Set())) {
      const parsed = compare(span.text, `RNW element ${elements++}`);
      assert.equal(parsed.status, "parsed");
      if (parsed.status === "parsed") rules += parsed.rules.length;
    }
  }
  assert.ok(elements >= 20);
  assert.ok(rules > 1000);
});

test("Emotion-style elements preserve boundaries and document ordinals", () => {
  const sources = [
    ".css-a{color:red}&{color:blue}",
    ".css-b{color:blue}",
    "@media screen{.css-c{display:block}}",
    "@layer a{}",
    ".css-b{color:blue}",
  ];
  const spans = sources.map((text) => ({
    start: 0,
    end: text.length,
    source: `<style>${text}</style>`,
    text,
  }));
  const assembled = parseInlineRuleList(
    spans,
    new CssResourceAnalysis().parser,
  );
  const native = new LightningCssRuleParser();
  const whole = sources
    .flatMap((source) => {
      const parsed = native.parse(source);
      assert.ok(parsed.status === "parsed");
      return parsed.rules;
    })
    .map((rule, ordinal) => ({ ...rule, ordinal }));
  assert.deepEqual(
    parseSnapshot(assembled),
    parseSnapshot({ status: "parsed", rules: whole }),
  );
});

for (const source of [
  "<!--a{color:red}",
  "<!---->",
  "<!--body{color:red}-->",
  "b{color:blue}<!--a{color:red}",
])
  test(`CDO-word fallback retains whole failure: ${source}`, () => {
    assert.equal(segmentOracle()(source, source).status, "unresolved");
  });

test("batch locations count normalized UTF-16 units, including astral and lone-surrogate text", () => {
  const compare = segmentOracle();
  for (const source of [
    "/*😀*/.😀{--text:'你😀'} .你{color:red}",
    ".a{--text:'\ud800'}\r\n.你{color:red}\f.b{}",
    "\uFEFF.a{}\r\n/*你好😀*/.b{color:blue}",
  ])
    compare(source, JSON.stringify(source));
});
