import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  ExportIgnoredMatcher,
  isExportIgnoredPath,
} from "../dist/export/ignored.js";
import {
  EXPORT_MARKER,
  parseExportOwnership,
} from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { isPackageOwnedIgnoredWatchPath } from "../dist/server/watch_paths.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import { createExportFixture } from "./helpers/export_fixture.js";

test("watch ownership follows the inventory and does not suppress unowned descendants", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const config = {
    ...fixture.config,
    watch: {
      debounceMs: 10,
      rules: [{ action: "rebuild" as const, paths: ["**/*"] }],
    },
  };
  for (const name of [
    "notes.md",
    "static/new-input.json",
    "new-folder/input.txt",
  ])
    assert.equal(
      classifyWatchPath(
        { path: path.join(fixture.output, name), kind: "change" },
        config,
      ),
      "rebuild",
      name,
    );
  for (const name of [
    EXPORT_MARKER,
    "index.html",
    "static/home/index.mobile.html",
  ])
    assert.equal(
      classifyWatchPath(
        { path: path.join(fixture.output, name), kind: "change" },
        config,
      ),
      "ignore",
      name,
    );
});

test("retired schema 1 markers do not suppress watch paths", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.mkdir(fixture.output);
  await fs.promises.writeFile(path.join(fixture.output, "index.html"), "Old");
  await fs.promises.writeFile(
    path.join(fixture.output, EXPORT_MARKER),
    JSON.stringify({ schemaVersion: 1, files: ["index.html"] }),
  );
  for (const name of [EXPORT_MARKER, "index.html"])
    assert.equal(
      isExportIgnoredPath(path.join(fixture.output, name), fixture.root),
      false,
      name,
    );
});

test("watch parses an unchanged marker once and reparses after replacement", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  let parses = 0;
  const matcher = new ExportIgnoredMatcher({
    lstat: (candidate) => fs.lstatSync(candidate),
    read: (candidate) => fs.readFileSync(candidate, "utf8"),
    parse(content) {
      parses++;
      return parseExportOwnership(content);
    },
  });
  const owned = [EXPORT_MARKER, "index.html", "static/home/index.mobile.html"];
  for (let iteration = 0; iteration < 5; iteration++)
    for (const name of owned)
      assert.equal(
        matcher.isIgnored(path.join(fixture.output, name), fixture.root),
        true,
        name,
      );
  assert.equal(parses, 1);
  await fs.promises.appendFile(path.join(fixture.output, EXPORT_MARKER), "\n");
  assert.equal(
    matcher.isIgnored(path.join(fixture.output, "index.html"), fixture.root),
    true,
  );
  assert.equal(parses, 2);
});

test("watch accepts ownership markers between 8 and 64 MiB", () => {
  const root = path.resolve("repository");
  const output = path.join(root, "site");
  const marker = path.join(output, EXPORT_MARKER);
  const content = JSON.stringify({
    schemaVersion: 2,
    files: [{ path: "index.html", sha256: "a".repeat(64), size: 1 }],
  });
  const matcher = new ExportIgnoredMatcher({
    lstat(candidate) {
      if (candidate !== marker)
        throw Object.assign(new Error(), { code: "ENOENT" });
      return {
        ctimeMs: 1,
        dev: 1,
        ino: 1,
        isFile: () => true,
        mtimeMs: 1,
        size: 9 * 1024 * 1024,
      };
    },
    parse: parseExportOwnership,
    read: () => content,
  });
  assert.equal(matcher.isIgnored(path.join(output, "index.html"), root), true);
});

test("the real watcher traverses owned directories to observe later unowned additions", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const config = {
    ...fixture.config,
    watch: {
      debounceMs: 10,
      rules: [{ action: "reload" as const, paths: ["**/*"] }],
    },
  };
  const watcher = new ChokidarWatcherFactory().create(
    [fixture.root],
    (candidate) => isPackageOwnedIgnoredWatchPath(candidate, config),
  );
  context.after(() => watcher.close());
  const events: string[] = [];
  watcher.onChange((event) => events.push(event.path));
  watcher.onError((error) => {
    throw error;
  });
  await watcher.ready();
  const unowned = path.join(fixture.output, "static", "notes.md");
  await fs.promises.writeFile(unowned, "An authored input\n");
  await fs.promises.appendFile(path.join(fixture.output, "index.html"), "\n");
  const deadline = Date.now() + 15_000;
  while (!events.includes(unowned) && Date.now() < deadline) await delay(25);
  assert.ok(
    events.includes(unowned),
    "an unlisted file must reach the real watcher",
  );
  assert.ok(!events.includes(path.join(fixture.output, "index.html")));
});
