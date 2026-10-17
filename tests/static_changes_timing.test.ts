import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { fixture, git, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "a failed base preparation ends its timing span with error while unavailable Changes settles",
  { timeout: 120_000 },
  async () => {
    const { root } = await fixture();
    try {
      await write(root, "broken.config.json", "{invalid");
      await git(root, "add", "broken.config.json");
      await git(root, "commit", "-qm", "broken historical config");
      await git(root, "branch", "broken-base");
      await write(root, "broken.config.json", "{}");
      const result = await command(root, "build", [
        "--out=.context/site",
        "--config=broken.config.json",
        "--base=broken-base",
        "--debug-timings",
      ]).result;
      assert.equal(result.code, 0, result.stderr);
      const ends = timings(result.stderr).filter(
        (record) => record.event === "end",
      );
      assert.equal(
        ends.find((record) => record.stage === "review.base-tree")!.status,
        "error",
      );
      assert.equal(
        ends.find((record) => record.stage === "changes.classify")!.status,
        "ok",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
