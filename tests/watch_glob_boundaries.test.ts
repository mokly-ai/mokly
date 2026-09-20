import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { isPackageOwnedIgnoredWatchPath } from "../dist/server/watch_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("entry glob roots prune ignored descendants without pruning their ancestors", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const srcConfig: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**/*.mockup.{ts,tsx}"],
    entryModules: [
      path.join(fixture.root, "src/components/card/card.mockup.tsx"),
    ],
  };
  delete srcConfig.entriesDir;
  for (const relative of ["src/node_modules/x/index.js", "src/dist/x.js"]) {
    assert.equal(
      isPackageOwnedIgnoredWatchPath(
        path.join(fixture.root, relative),
        srcConfig,
      ),
      true,
      relative,
    );
  }
  for (const relative of ["src/components/card/card.mockup.tsx", "src"]) {
    assert.equal(
      isPackageOwnedIgnoredWatchPath(
        path.join(fixture.root, relative),
        srcConfig,
      ),
      false,
      relative,
    );
  }

  const rootConfig: ResolvedConfig = {
    ...srcConfig,
    entryGlobs: ["**/*.mockup.{ts,tsx}"],
  };
  for (const relative of ["node_modules/x/index.js", ".git/HEAD"]) {
    assert.equal(
      isPackageOwnedIgnoredWatchPath(
        path.join(fixture.root, relative),
        rootConfig,
      ),
      true,
      relative,
    );
  }
});

test("entry candidates inside discovery-denied trees stay ignored", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["**/*.mockup.{ts,tsx}"],
  };
  delete config.entriesDir;
  for (const relative of [
    "node_modules/x/new.mockup.tsx",
    ".git/new.mockup.tsx",
    ".mokly-cache/new.mockup.tsx",
    ".review/new.mockup.tsx",
  ]) {
    assert.equal(
      classifyWatchPath(path.join(fixture.root, relative), config),
      "ignore",
      relative,
    );
  }
});
