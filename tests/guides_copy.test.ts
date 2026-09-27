import assert from "node:assert/strict";
import test from "node:test";

import { GUIDES, withoutFencedCode } from "./helpers/guides.js";

const NEVER = ["not supported", "coming soon", "roadmap"];
const ENGINEERING = [
  /\bprotocols?\b/iu,
  /\bspecs?\b|\bspecifications?\b/iu,
  /\bmilestones?\b/iu,
  /\bdelivery status\b/iu,
  /\bimplementation plans?\b/iu,
  /\b(?:unit|integration|browser|regression) tests?\b/iu,
];

function prose(body: string): string {
  return withoutFencedCode(body)
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/`[^`]*`/gu, " ")
    .replace(/\s+/gu, " ");
}

test("guide prose follows the reader-facing copy exclusions", () => {
  for (const guide of GUIDES) {
    const text = prose(guide.body);
    for (const phrase of NEVER)
      assert.doesNotMatch(
        text,
        new RegExp(phrase, "iu"),
        `${guide.id}: ${phrase}`,
      );
  }
});

test("guide prose never cites engineering specs or process", () => {
  for (const guide of GUIDES) {
    const text = `${guide.frontmatter.title} ${guide.frontmatter.description} ${prose(guide.body)}`;
    for (const pattern of ENGINEERING)
      assert.doesNotMatch(text, pattern, `${guide.id}: ${pattern}`);
  }
});

const REPOSITORY_PATHS = [
  /\bdocs\/(?:architecture|protocol|reviews|superpowers)\/(?!fixtures\/)/u,
  /(?:^|[\s`'"(])plans\//u,
  /\bmokly-[a-z0-9-]+\.md\b/u,
  /\bimplementation-review-prompt\b/u,
];

test("guides never name Mokly's own specs or plans, even in code spans", () => {
  const cited = (text: string) =>
    REPOSITORY_PATHS.filter((pattern) => pattern.test(text));
  for (const guide of GUIDES) {
    const text = withoutFencedCode(guide.body).replace(
      /<!--[\s\S]*?-->/gu,
      " ",
    );
    assert.deepEqual(cited(text), [], guide.id);
  }
  for (const citation of [
    "see `docs/protocol/mokly-upload.md`",
    "`plans/package-documentation.md`",
    "the mokly-guides.md contract",
    "docs/architecture/build-pipeline.md",
  ])
    assert.notDeepEqual(cited(citation), [], citation);
  for (const allowed of [
    "`node_modules/@mokly/mokly/docs/protocol/fixtures/export-ownership-v1.json`",
    "`src/plans/checkout.tsx`",
    "`docs/mockups/entries`",
  ])
    assert.deepEqual(cited(allowed), [], allowed);
});
