import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { command, publicationFixture } from "./helpers/static_publication.js";

test(
  "consumer inspector metadata fails with its document route and build category",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    try {
      await fs.writeFile(
        path.join(root, "specs/home.screen.html"),
        '---\ntitle: Home\n---\n<a href="#home" data-mokly-inspector-link="0">Home</a><h1 id="home">Home</h1>',
      );
      const result = await command(
        root,
        "build",
        ["--no-changes"],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, 1);
      assert.match(
        result.stderr,
        /\[mokly\/build-invalid\] home\/index\.(desktop|mobile)\.html: data-mokly-inspector-link is reserved/,
      );
      assert.ok(!result.stderr.includes("[mokly-static"));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
