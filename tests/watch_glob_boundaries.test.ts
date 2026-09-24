import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  classifyWatchPath,
  NotificationGate,
  type WatchEvent,
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
    entryGlobs: ["src/**/*.ts"],
    entryModules: [],
  };
  delete config.entriesDir;
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
    entryGlobs: ["src/**"],
    entryModules: [],
  };
  delete config.entriesDir;
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
    () => classifyWatchPath({ path: candidate, kind: "change" }, config),
    /unexpected path failure/,
  );
  const reported: unknown[] = [];
  const delivered: string[] = [];
  const gate = new NotificationGate<WatchEvent>((error) =>
    reported.push(error),
  );
  gate.notify({ path: candidate, kind: "add" });
  gate.open((value) => delivered.push(classifyWatchPath(value, config)));
  gate.notify({ path: candidate, kind: "add" });
  gate.notify({ path: fixture.entryPath, kind: "change" });
  assert.deepEqual(
    reported.map((error) => String(error)),
    ["Error: unexpected path failure", "Error: unexpected path failure"],
  );
  assert.deepEqual(delivered, ["rebuild"]);
});

for (const kind of ["addDir", "change", "unlinkDir"] as const) {
  test(`${kind} for a denied directory outranks user watch rules`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const loaded = await loadConfig(fixture.root);
    const config: ResolvedConfig = {
      ...loaded,
      entryGlobs: ["src/**"],
      entryModules: [],
      watch: {
        debounceMs: 0,
        rules: [{ action: "reload", paths: ["src/**"] }],
      },
    };
    delete config.entriesDir;
    const candidate = path.join(fixture.root, "src/dist");
    await fs.promises.mkdir(candidate, { recursive: true });
    const stats = fs.statSync(candidate);
    if (kind === "unlinkDir") await fs.promises.rmdir(candidate);
    const event = {
      path: candidate,
      kind,
      ...(kind === "change" ? { stats } : {}),
    };
    context.mock.method(fs, "statSync", () =>
      assert.fail("event directory status must not stat"),
    );
    assert.equal(classifyWatchPath(event, config), "ignore");
  });
}

test("unlink of an ordinary matched entry rebuilds and add beneath dist stays ignored", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**"],
    entryModules: [],
  };
  delete config.entriesDir;
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

test("raw denied-leaf events and traversal fail open under descriptor exhaustion", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    entryGlobs: ["src/**"],
    entryModules: [],
  };
  delete config.entriesDir;
  const candidate = path.join(fixture.root, "src/dist");
  const failure = Object.assign(new Error("descriptor limit"), {
    code: "EMFILE",
  });
  const stat = context.mock.method(fs, "statSync", () => {
    throw failure;
  });
  assert.equal(
    classifyWatchPath({ path: candidate, kind: "raw" }, config),
    "rebuild",
  );
  assert.equal(stat.mock.callCount(), 1);
  for (const method of ["lstatSync", "readFileSync", "openSync"] as const)
    context.mock.method(fs, method, () => {
      throw failure;
    });
  assert.equal(isPackageOwnedIgnoredWatchPath(candidate, config), false);
  assert.equal(
    isPackageOwnedIgnoredWatchPath(
      path.join(fixture.mockupsDir, "unowned.html"),
      config,
    ),
    false,
  );
});
