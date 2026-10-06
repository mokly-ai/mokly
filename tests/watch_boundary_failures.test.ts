import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../packages/mokly/dist/config/load.js";
import type { ResolvedConfig } from "../packages/mokly/dist/config/types.js";
import {
  classifyWatchPath,
  NotificationGate,
  type WatchEvent,
} from "../packages/mokly/dist/server/watch_events.js";
import { isPackageOwnedIgnoredWatchPath } from "../packages/mokly/dist/server/watch_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("a notification gate reports classifier errors and keeps delivering", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    roots: [
      {
        dir: path.resolve(fixture.root, "entries"),
        files: ["**/*.mockup.{ts,tsx}"],
        transparent: [],
      },
    ],
    entryModules: [fixture.entryPath],
  };
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
      roots: [
        {
          dir: path.resolve(fixture.root, "src"),
          files: ["**"],
          transparent: [],
        },
      ],
      entryModules: [],
      watch: {
        debounceMs: 0,
        rules: [{ action: "reload", paths: ["src/**"] }],
      },
    };
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

test("raw denied-leaf events and traversal fail open under descriptor exhaustion", async (context) => {
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
