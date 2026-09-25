import assert from "node:assert/strict";
import test from "node:test";

import { GUIDES, withoutFencedCode } from "./helpers/guides.js";

const NEVER = ["not supported", "coming soon", "roadmap"];

test("guide prose follows the reader-facing copy exclusions", () => {
  for (const guide of GUIDES) {
    const prose = withoutFencedCode(guide.body)
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/`[^`]*`/gu, " ")
      .replace(/\s+/gu, " ");
    for (const phrase of NEVER)
      assert.doesNotMatch(
        prose,
        new RegExp(phrase, "iu"),
        `${guide.id}: ${phrase}`,
      );
  }
});

test("packaged guides omit repository-only paths and internal implementation names", () => {
  for (const guide of GUIDES)
    for (const forbidden of [
      /examples\//u,
      /BROWSERSLIST_IGNORE_OLD_DATA/u,
      /\bencodeUrlPath\b/u,
    ])
      assert.doesNotMatch(guide.body, forbidden, `${guide.id}: ${forbidden}`);
});
