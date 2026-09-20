import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverEntryModules } from "../dist/config/entry_discovery.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("entriesDir resolves lexical paths through an in-repository symlink and rejects an escape", async (context) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  const physicalEntries = path.join(fixture.root, "source-entries");
  await fs.promises.rename(fixture.entriesDir, physicalEntries);
  await fs.promises.symlink("source-entries", fixture.entriesDir);

  const config = await loadConfig(fixture.root);
  assert.equal(config.entriesDir, fixture.entriesDir);
  assert.deepEqual(config.entryModules, [fixture.entryPath]);
  assert.deepEqual(discoverEntryModules(config), [fixture.entryPath]);

  await fs.promises.rm(fixture.entriesDir);
  await fs.promises.symlink(outside.entriesDir, fixture.entriesDir);
  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message: /entriesDir resolves outside repoRoot through a symlink/,
  });
});

test("a missing entry glob stable prefix reports the zero-match error", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entries: ["missing/**/*.mockup.{ts,tsx}"], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /entries glob matches no module: missing\/\*\*\/\*\.mockup\.\{ts,tsx\}/,
  });
});

test("entry globs with backslashes normalize to POSIX", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entries: ["entries\\\\**\\\\*.mockup.{ts,tsx}"], mockupsDir: "mockups", repoRoot: "." };\n',
  );

  const config = await loadConfig(fixture.root);
  assert.deepEqual(config.entryGlobs, ["entries/**/*.mockup.{ts,tsx}"]);
  assert.deepEqual(config.entryModules, [fixture.entryPath]);
});

test("entry glob validation translates minimatch expansion failures", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const oversized = `entries/${"x".repeat(65_536)}.mockup.tsx`;

  assert.throws(
    () =>
      resolveConfig(
        { entries: [oversized], mockupsDir: "mockups" },
        fixture.configPath,
      ),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "config-invalid");
      assert.match(
        error.message,
        /entries requires safe relative POSIX globs; invalid item/,
      );
      return true;
    },
  );
});

test("direct discovery retains the cache denial as defense in depth", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const cacheEntry = path.join(fixture.root, ".mokly-cache/defense.mockup.tsx");
  await fs.promises.mkdir(path.dirname(cacheEntry), { recursive: true });
  await fs.promises.writeFile(cacheEntry, "export const mockups = [];\n");
  const config = await loadConfig(fixture.root);

  assert.throws(
    () =>
      discoverEntryModules({
        ...config,
        entryGlobs: [".mokly-cache/*.mockup.tsx"],
      }),
    {
      code: "config-invalid",
      message:
        /entry module \.mokly-cache\/defense\.mockup\.tsx is inside the private \.mokly-cache directory/,
    },
  );
});
