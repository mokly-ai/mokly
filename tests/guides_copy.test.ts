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
