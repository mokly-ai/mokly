import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReviewPair } from "../dist/review/ignore.js";
import { PageAnalysisPair } from "../dist/review/page_pair.js";

const view = {
  path: "screens/home.mobile.html",
  viewport: "mobile",
  colorScheme: "light",
} as const;
const region = (id: string, text: string) =>
  `<!--mokly-review-ignore:start:${id}-->${text}<!--mokly-review-ignore:end:${id}-->`;
const material = (id: string, key: string) =>
  `<!--mokly-review-material:${id}:${key.repeat(64)}-->`;

test("metadata-only original ignore pairing equals delivered normalization", () => {
  const sources = [
    "<main>same</main>",
    region("clock", "one"),
    region("clock", "two"),
    material("clock", "a") + region("clock", "one"),
    material("clock", "b") + region("clock", "two"),
    region("first", "one") + region("clock", "two"),
    region("last", "one") + region("first", "two"),
    `<textarea>${region("clock", "raw")}</textarea>`,
    `<style>/*${region("clock", "raw")}*/.entry{color:red}</style>`,
  ];
  for (const base of sources)
    for (const head of sources) {
      const pages = new PageAnalysisPair(view, view, base, head);
      const expected = normalizeReviewPair(base, head, view.path);
      assert.deepEqual(pages.pairedIgnoreIds, expected.pairedIgnoreIds);
      assert.deepEqual(pages.normalization, expected);
      assert.deepEqual(pages.pairedIgnoreIds, expected.pairedIgnoreIds);
    }
});
