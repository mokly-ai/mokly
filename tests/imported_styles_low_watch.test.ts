import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("PostCSS directory watches rebuild on additions, not deletions", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = path.join(fixture.root, "sources");
  await fs.mkdir(root);
  const config = {
    ...(await loadConfig(fixture.root)),
    postcssWatchDirectories: [{ directory: root, glob: "*.tsx" }],
  };
  assert.equal(
    classifyWatchPath(
      { path: path.join(root, "old.tsx"), kind: "unlink" },
      config,
    ),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(root, "new.tsx"), kind: "add" },
      config,
    ),
    "rebuild",
  );
  assert.equal(
    classifyWatchPath({ path: path.join(root, "new"), kind: "addDir" }, config),
    "rebuild",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(root, "new"), kind: "unlinkDir" },
      config,
    ),
    "ignore",
  );
});

test("Tailwind's star root report rebuilds for a newly added subdirectory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = path.join(fixture.root, "sources");
  await fs.mkdir(root);
  const config = {
    ...(await loadConfig(fixture.root)),
    postcssWatchDirectories: [{ directory: root, glob: "*" }],
  };
  const child = path.join(root, "new-dir");
  assert.equal(
    classifyWatchPath({ path: child, kind: "addDir" }, config),
    "rebuild",
  );
  await fs.mkdir(child);
  assert.equal(
    classifyWatchPath(
      { path: path.join(child, "new.tsx"), kind: "add" },
      config,
    ),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(root, "ignored", "x"), kind: "addDir" },
      {
        ...config,
        review: { ...config.review, outDir: path.join(root, "ignored") },
      },
    ),
    "ignore",
  );
});
