import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../packages/mokly/dist/config/load.js";
import type { ResolvedConfig } from "../packages/mokly/dist/config/types.js";
import { classifyWatchPath } from "../packages/mokly/dist/server/watch_events.js";
import {
  isEntryGlobCandidate,
  isPackageOwnedIgnoredWatchPath,
} from "../packages/mokly/dist/server/watch_paths.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("entry glob roots prune ignored descendants without pruning their ancestors", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const srcConfig: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
    ],
    entryModules: [
      path.join(fixture.root, "src/components/card/card.mockup.tsx"),
    ],
  };
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
    roots: [
      {
        dir: path.resolve(fixture.root, "."),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
    ],
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

test("discovery and watching share denied segments below glob roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const baseline = await loadConfig(fixture.root);
  const broad: ResolvedConfig = {
    ...baseline,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  const denied = path.join(fixture.root, "src/dist/x.mockup.tsx");
  await fs.promises.mkdir(path.dirname(denied), { recursive: true });
  await fs.promises.writeFile(denied, validEntrySource());
  assert.equal(isPackageOwnedIgnoredWatchPath(denied, broad), true);
  assert.equal(isEntryGlobCandidate(denied, broad), false);
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: "src", files: ["**/*.mockup.{ts,tsx}"] }], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message: /root matches no file: src; not searched: src\/dist/,
  });

  const loaded = await loadConfigFor(fixture);
  const explicit = path.join(fixture.root, "dist/entries/a.mockup.tsx");
  assert.deepEqual(loaded.entryModules, [explicit]);
  assert.equal(isPackageOwnedIgnoredWatchPath(explicit, loaded), false);
  assert.equal(isEntryGlobCandidate(explicit, loaded), true);
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.root, "dist/entries/new.ts"), kind: "change" },
      loaded,
    ),
    "rebuild",
  );
});

test("a non-matching glob root is excluded from the entry denial base", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
      {
        dir: path.resolve(fixture.root, "src/dist/entries"),
        files: ["**/*.json"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  assert.equal(
    isEntryGlobCandidate(
      path.join(fixture.root, "src/dist/entries/new.mockup.tsx"),
      config,
    ),
    false,
  );
});

async function loadConfigFor(
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<ResolvedConfig> {
  const entry = path.join(fixture.root, "dist/entries/a.mockup.tsx");
  await fs.promises.mkdir(path.dirname(entry), { recursive: true });
  await fs.promises.writeFile(entry, validEntrySource());
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{dir:"dist/entries",files:["**"]}], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  return loadConfig(fixture.root);
}
