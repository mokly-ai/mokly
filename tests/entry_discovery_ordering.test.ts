import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverEntryModules } from "../dist/config/entry_discovery.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

test("per-glob validation follows declaration order", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const reviewOut = path.join(fixture.root, ".review");
  await fs.promises.mkdir(reviewOut);
  await fs.promises.writeFile(
    path.join(reviewOut, "denied.mockup.tsx"),
    validEntrySource(),
  );
  const denied = ".review/**/*.mockup.tsx";
  const empty = "missing/**/*.mockup.tsx";
  const direct = {
    ...config,
    review: { ...config.review, outDir: reviewOut },
  };

  assert.throws(
    () => discoverEntryModules({ ...direct, entryGlobs: [denied, empty] }),
    {
      code: "config-invalid",
      message:
        /entry module \.review\/denied\.mockup\.tsx is inside review\.outDir$/,
    },
  );
  assert.throws(
    () => discoverEntryModules({ ...direct, entryGlobs: [empty, denied] }),
    {
      code: "config-invalid",
      message:
        /entries glob matches no module: missing\/\*\*\/\*\.mockup\.tsx; not searched: missing$/,
    },
  );
});

test("shared root projection precedes per-glob validation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const reviewOut = path.join(fixture.root, ".review");
  const laterRoot = path.join(fixture.root, "later");
  await fs.promises.mkdir(reviewOut);
  await fs.promises.mkdir(laterRoot);
  await fs.promises.writeFile(
    path.join(reviewOut, "denied.mockup.tsx"),
    validEntrySource(),
  );
  await fs.promises.writeFile(
    path.join(laterRoot, "visible.mockup.tsx"),
    validEntrySource(),
  );
  const failure = Object.assign(new Error("later root unavailable"), {
    code: "EACCES",
  });
  const realpath = fs.realpathSync.native;
  context.mock.method(fs.realpathSync, "native", (...args: unknown[]) => {
    if (args[0] === laterRoot) throw failure;
    return Reflect.apply(realpath, fs.realpathSync, args);
  });

  assert.throws(
    () =>
      discoverEntryModules({
        ...config,
        entryGlobs: [".review/**/*.mockup.tsx", "later/**/*.mockup.tsx"],
        review: { ...config.review, outDir: reviewOut },
      }),
    {
      code: "config-invalid",
      message: /cannot discover entry path later: EACCES$/,
      cause: failure,
    },
  );
});

test("overlapping globs validate accepted and vanished candidates once", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const surviving = path.join(fixture.entriesDir, "surviving.mockup.tsx");
  await fs.promises.writeFile(surviving, validEntrySource());
  const config = await loadConfig(fixture.root);
  const lstat = fs.lstatSync;
  const realpath = fs.realpathSync.native;
  let vanishedChecks = 0;
  let survivingProjections = 0;
  context.mock.method(fs, "lstatSync", (...args: unknown[]) => {
    if (args[0] === fixture.entryPath) {
      vanishedChecks += 1;
      throw Object.assign(new Error("vanished"), { code: "ENOENT" });
    }
    return Reflect.apply(lstat, fs, args);
  });
  context.mock.method(fs.realpathSync, "native", (...args: unknown[]) => {
    if (args[0] === surviving) survivingProjections += 1;
    return Reflect.apply(realpath, fs.realpathSync, args);
  });

  assert.deepEqual(
    discoverEntryModules({
      ...config,
      entryGlobs: ["entries/**/*.mockup.tsx", "entries/*.mockup.tsx"],
    }),
    [surviving],
  );
  assert.equal(vanishedChecks, 1);
  assert.equal(survivingProjections, 2);
});

test("cache roots fail config while direct discovery distinguishes races", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const cache = path.join(fixture.root, ".mokly-cache");
  const vanished = path.join(cache, "vanished.mockup.tsx");
  const surviving = path.join(cache, "surviving.mockup.tsx");
  await fs.promises.mkdir(cache);
  await fs.promises.writeFile(vanished, validEntrySource());
  await fs.promises.writeFile(surviving, validEntrySource());

  assert.throws(
    () =>
      resolveConfig(
        {
          entries: [".mokly-cache/*.mockup.tsx"],
          mockupsDir: "mockups",
        },
        fixture.configPath,
      ),
    {
      code: "config-invalid",
      message:
        /entries glob must stay inside repoRoot and outside \.mokly-cache/,
    },
  );

  const config = await loadConfig(fixture.root);
  const lstat = fs.lstatSync;
  let vanishedChecks = 0;
  context.mock.method(fs, "lstatSync", (...args: unknown[]) => {
    if (args[0] === vanished) {
      vanishedChecks += 1;
      throw Object.assign(new Error("vanished"), { code: "ENOENT" });
    }
    return Reflect.apply(lstat, fs, args);
  });

  assert.throws(
    () =>
      discoverEntryModules({
        ...config,
        entryGlobs: [".mokly-cache/vanished.mockup.tsx"],
      }),
    {
      code: "config-invalid",
      message:
        /entries glob matches no module: \.mokly-cache\/vanished\.mockup\.tsx; not searched: \.mokly-cache\/vanished\.mockup\.tsx$/,
    },
  );
  assert.equal(vanishedChecks, 1);
  assert.throws(
    () =>
      discoverEntryModules({
        ...config,
        entryGlobs: [".mokly-cache/surviving.mockup.tsx"],
      }),
    {
      code: "config-invalid",
      message:
        /entry module \.mokly-cache\/surviving\.mockup\.tsx is inside the private \.mokly-cache directory$/,
    },
  );
});
