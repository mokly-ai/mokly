import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

for (const [source, open] of [
  ["<!doctype html><html><body></body></html><svg>", true],
  ["<!doctype html><html><body></body></html><math>", true],
  ["<svg><g>", true],
  ["<math><mi>", true],
  ["<svg></svg>", false],
  ["<math></math>", false],
  ["<svg/>", false],
  ["<style>.entry::before{content:'<svg>'}</style>", false],
  ['<p data-value="<math>"><!-- <svg> --></p>', false],
] as const)
  test(`original parser EOF foreign state: ${source}`, () => {
    const page = new PageAnalysis(source, "home/index.html");
    assert.equal(page.openForeignContent, open);
    assert.equal(
      page.openForeignContent,
      open,
      "state is stable on repeated reads",
    );
  });

test("foreign ignore-closer proof reuses the original tree and paired region offsets", async () => {
  const region = (content: string) =>
    `<!--mokly-review-ignore:start:x-->${content}<!--mokly-review-ignore:end:x-->`;
  for (const [source, paired, unsafe] of [
    [`<svg>${region("</svg>")}`, ["x"], true],
    [`<math>${region("</math>")}`, ["x"], true],
    [`<svg>${region("<div>d</div>")}`, ["x"], true],
    [`<svg>${region("</svg>")}`, [], false],
    [`<svg></svg>${region("text")}`, ["x"], false],
    [`<svg>${region("<g></g>")}</svg>`, ["x"], false],
    [region("<svg></svg>"), ["x"], false],
  ] as const) {
    const events: TimingEvent[] = [];
    await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(async () => {
          const page = new PageAnalysis(source, "home/index.html");
          assert.equal(page.openForeignContent, false, source);
          assert.equal(page.foreignContentMayStayOpen(paired), unsafe, source);
          assert.equal(
            page.foreignContentMayStayOpen(paired),
            unsafe,
            "repeated proof",
          );
        }),
      { write: (event) => events.push(event) },
    );
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts.htmlParses, 1, source);
    assert.equal(counts["htmlParses.pageAnalysis"], 1, source);
  }
});

test("the review README assigns foreign-content guards to their owning modules", async () => {
  const text = await fs.readFile("src/review/README.md", "utf8");
  const entry = (name: string) => {
    const start = text.indexOf(`- \`${name}\``);
    assert.ok(start >= 0, name);
    const end = text.indexOf("\n- ", start + 1);
    return text.slice(start, end < 0 ? undefined : end);
  };
  assert.match(entry("page_parser.ts"), /onEof/);
  for (const module of [
    "page_inline_material.ts",
    "component_style_route.ts",
  ]) {
    assert.match(entry(module), /SVG\/MathML/);
    assert.match(entry(module), /paired ignore/);
  }
  assert.doesNotMatch(entry("inline_link_material.ts"), /EOF/);
});
