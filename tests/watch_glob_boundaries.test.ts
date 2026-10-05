import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import {
  isEntryGlobCandidate,
  isPackageOwnedIgnoredWatchPath,
} from "../dist/server/watch_paths.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("entry candidates inside discovery-denied trees stay ignored", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "."),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
    ],
  };
  for (const relative of [
    "node_modules/x/new.mockup.tsx",
    ".git/new.mockup.tsx",
    ".mokly-cache/new.mockup.tsx",
    ".review/new.mockup.tsx",
  ]) {
    assert.equal(
      classifyWatchPath(
        { path: path.join(fixture.root, relative), kind: "change" },
        config,
      ),
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
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**/*.ts"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.root, "src/new-entry.ts"), kind: "change" },
      config,
    ),
    "rebuild",
  );
});

test("denied directory names remain valid regular-file basenames", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  const target = path.join(fixture.root, "src/target");
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, "export const mockups = [];\n");
  assert.equal(isEntryGlobCandidate(target, config), true);
  assert.equal(
    isPackageOwnedIgnoredWatchPath(target, config, undefined, "event"),
    false,
  );

  await fs.promises.rm(target);
  assert.equal(
    classifyWatchPath({ path: target, kind: "unlink" }, config),
    "rebuild",
  );
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

test("watch pruning derives denied-leaf directory status from supplied stats", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  const deniedLeaf = path.join(fixture.root, "src/dist");
  await fs.promises.mkdir(deniedLeaf, { recursive: true });
  const unowned = path.join(fixture.mockupsDir, "unowned.html");
  await fs.promises.writeFile(unowned, "<main>Unowned</main>");
  const fileStats = fs.statSync(unowned);
  assert.equal(isPackageOwnedIgnoredWatchPath(deniedLeaf, config), true);
  const calls = { statSync: 0, lstatSync: 0, readFileSync: 0, openSync: 0 };
  let allowMetadata = false;
  for (const method of [
    "statSync",
    "lstatSync",
    "readFileSync",
    "openSync",
  ] as const)
    context.mock.method(fs, method, () => {
      calls[method] += 1;
      if (method === "lstatSync" && allowMetadata) return fileStats;
      throw Object.assign(new Error("descriptor limit"), { code: "EMFILE" });
    });
  assert.equal(isPackageOwnedIgnoredWatchPath(deniedLeaf, config), false);
  const directoryStats = { isDirectory: () => true } as fs.Stats;
  assert.equal(
    isPackageOwnedIgnoredWatchPath(deniedLeaf, config, directoryStats),
    true,
  );
  assert.equal(
    isPackageOwnedIgnoredWatchPath(path.join(deniedLeaf, "x.ts"), config),
    true,
  );
  assert.equal(isPackageOwnedIgnoredWatchPath(unowned, config), false);
  assert.ok(calls.statSync > 0);
  assert.ok(calls.lstatSync > 0);
  allowMetadata = true;
  assert.equal(isPackageOwnedIgnoredWatchPath(deniedLeaf, config), false);
  assert.equal(isPackageOwnedIgnoredWatchPath(unowned, config), false);
  assert.ok(calls.readFileSync > 0);
  assert.equal(calls.openSync, 0);
});

test("unlink of an ordinary matched entry rebuilds and add beneath dist stays ignored", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "src"),
        files: ["**"],
        transparent: [],
      },
    ],
    entryModules: [],
  };
  const candidate = path.join(fixture.root, "src/plain.ts");
  await fs.promises.mkdir(path.dirname(candidate), { recursive: true });
  await fs.promises.writeFile(candidate, "export const mockups = [];\n");
  await fs.promises.rm(candidate);
  assert.equal(
    classifyWatchPath({ path: candidate, kind: "unlink" }, config),
    "rebuild",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.root, "src/dist/x.ts"), kind: "add" },
      config,
    ),
    "ignore",
  );
});
