import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  classifyWatchPath,
  NotificationGate,
} from "../dist/server/watch_events.js";
import {
  isEntryGlobCandidate,
  isPackageOwnedIgnoredWatchPath,
} from "../dist/server/watch_paths.js";

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

test("a custom entry glob rebuilds for every file shape it matches", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**/*.ts"],
    entryModules: [],
  };
  delete config.entriesDir;
  assert.equal(
    classifyWatchPath(path.join(fixture.root, "src/new-entry.ts"), config),
    "rebuild",
  );
});

test("denied directory names remain valid regular-file basenames", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**"],
    entryModules: [],
  };
  delete config.entriesDir;
  const target = path.join(fixture.root, "src/target");
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, "export const mockups = [];\n");
  assert.equal(isEntryGlobCandidate(target, config), true);
  assert.equal(
    isPackageOwnedIgnoredWatchPath(target, config, undefined, "event"),
    false,
  );

  await fs.promises.rm(target);
  assert.equal(classifyWatchPath(target, config), "ignore");
  const nested = path.join(target, "x.mockup.tsx");
  await fs.promises.mkdir(target);
  await fs.promises.writeFile(nested, validEntrySource());
  assert.equal(isEntryGlobCandidate(nested, config), false);
  assert.equal(
    isPackageOwnedIgnoredWatchPath(target, config, fs.statSync(target)),
    true,
  );
  assert.equal(isPackageOwnedIgnoredWatchPath(nested, config), true);
});

test("watch pruning uses supplied stats without filesystem I/O", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**"],
    entryModules: [],
  };
  delete config.entriesDir;
  const deniedLeaf = path.join(fixture.root, "src/dist");
  assert.doesNotThrow(() => isPackageOwnedIgnoredWatchPath(deniedLeaf, config));
  context.mock.method(fs, "statSync", () => {
    const error = new Error("descriptor limit") as NodeJS.ErrnoException;
    error.code = "EMFILE";
    throw error;
  });
  assert.doesNotThrow(() => isPackageOwnedIgnoredWatchPath(deniedLeaf, config));
  const directoryStats = { isDirectory: () => true } as fs.Stats;
  assert.equal(
    isPackageOwnedIgnoredWatchPath(deniedLeaf, config, directoryStats),
    true,
  );
  assert.equal(
    isPackageOwnedIgnoredWatchPath(path.join(deniedLeaf, "x.ts"), config),
    true,
  );
});

test("discovery and watching share denied segments below glob roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const baseline = await loadConfig(fixture.root);
  const broad: ResolvedConfig = {
    ...baseline,
    entryGlobs: ["src/**/*.mockup.{ts,tsx}"],
    entryModules: [],
  };
  delete broad.entriesDir;
  const denied = path.join(fixture.root, "src/dist/x.mockup.tsx");
  await fs.promises.mkdir(path.dirname(denied), { recursive: true });
  await fs.promises.writeFile(denied, validEntrySource());
  assert.equal(isPackageOwnedIgnoredWatchPath(denied, broad), true);
  assert.equal(isEntryGlobCandidate(denied, broad), false);
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entries: ["src/**/*.mockup.{ts,tsx}"], mockupsDir: "mockups", repoRoot: "." };\n',
  );
  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /entries glob matches no module: src\/\*\*\/\*\.mockup\.\{ts,tsx\}; not searched: src\/dist/,
  });

  const loaded = await loadConfigFor(fixture, "dist/entries/**");
  const explicit = path.join(fixture.root, "dist/entries/a.mockup.tsx");
  assert.deepEqual(loaded.entryModules, [explicit]);
  assert.equal(isPackageOwnedIgnoredWatchPath(explicit, loaded), false);
  assert.equal(isEntryGlobCandidate(explicit, loaded), true);
  assert.equal(
    classifyWatchPath(path.join(fixture.root, "dist/entries/new.ts"), loaded),
    "rebuild",
  );
});

test("a notification gate reports classifier errors and keeps delivering", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["entries/**/*.mockup.{ts,tsx}"],
    entryModules: [fixture.entryPath],
  };
  delete config.entriesDir;
  const candidate = path.join(fixture.root, "entries/new.mockup.tsx");
  const lstatSync = fs.lstatSync;
  context.mock.method(fs, "lstatSync", (value: fs.PathLike) => {
    if (value === candidate) {
      const error = new Error(
        "unexpected path failure",
      ) as NodeJS.ErrnoException;
      error.code = "EIO";
      throw error;
    }
    return lstatSync(value);
  });
  assert.throws(
    () => classifyWatchPath(candidate, config),
    /unexpected path failure/,
  );
  const reported: unknown[] = [];
  const delivered: string[] = [];
  const gate = new NotificationGate<string>((error) => reported.push(error));
  gate.notify(candidate);
  gate.open((value) => delivered.push(classifyWatchPath(value, config)));
  gate.notify(candidate);
  gate.notify(fixture.entryPath);
  assert.deepEqual(
    reported.map((error) => String(error)),
    ["Error: unexpected path failure", "Error: unexpected path failure"],
  );
  assert.deepEqual(delivered, ["rebuild"]);
});

test("a non-matching glob root is excluded from the entry denial base", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**/*.mockup.{ts,tsx}", "src/dist/entries/**/*.json"],
    entryModules: [],
  };
  delete config.entriesDir;
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
  glob: string,
): Promise<ResolvedConfig> {
  const entry = path.join(fixture.root, "dist/entries/a.mockup.tsx");
  await fs.promises.mkdir(path.dirname(entry), { recursive: true });
  await fs.promises.writeFile(entry, validEntrySource());
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { entries: [${JSON.stringify(glob)}], mockupsDir: "mockups", repoRoot: "." };\n`,
  );
  return loadConfig(fixture.root);
}
