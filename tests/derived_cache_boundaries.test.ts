import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { isPublicStaticFile } from "../dist/config/public_files.js";
import { resolveExportOutput } from "../dist/export/paths.js";
import { reviewChangedPaths } from "../dist/review/changed_paths.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import {
  isPackageOwnedIgnoredWatchPath,
  watchTargets,
} from "../dist/server/watch_paths.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

test("cache exclusions precede broad globs, resource matching and required source exceptions", async (t) => {
  const fixture = await derivedFixture(t);
  const cache = path.join(fixture.root, ".mokly-cache");
  await fs.mkdir(cache);
  await fs.writeFile(path.join(cache, "private.txt"), "private");
  await fs.symlink(".mokly-cache", path.join(fixture.root, "alias"));
  const paths = [".mokly-cache/private.txt", "alias/private.txt"];
  const config = {
    ...fixture.config,
    sourceFiles: paths,
    configSourceFiles: paths,
    watch: {
      debounceMs: 1,
      rules: [
        {
          action: "rebuild" as const,
          paths: ["**", ".mokly-cache/**", "alias/**"],
        },
      ],
    },
  };
  for (const relative of paths) {
    const absolute = path.join(fixture.root, relative);
    assert.equal(
      classifyWatchPath(
        { path: absolute, kind: "change" },
        config,
        new Set([absolute]),
      ),
      "ignore",
    );
    assert.equal(isPackageOwnedIgnoredWatchPath(absolute, config), true);
    assert.equal(watchTargets(config).includes(absolute), false);
  }
  const changed = await reviewChangedPaths(
    {
      mergeBase: async () => fixture.commit,
      changedPaths: async (_commit, excluded) => {
        assert.ok(excluded?.includes(".mokly-cache"));
        return [...paths, "notes.md"];
      },
    },
    fixture.commit,
    config,
    config.review.outDir,
  );
  assert.deepEqual(changed, ["notes.md"]);
  for (const out of [".mokly-cache/export", "alias/export"])
    assert.throws(() => resolveExportOutput(config, out), {
      code: "export-invalid",
    });
  const rootPublic = { ...fixture.config, mockupsDir: fixture.root };
  for (const relative of paths)
    assert.equal(
      isPublicStaticFile(path.join(fixture.root, relative), rootPublic),
      false,
    );
});
