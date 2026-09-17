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
