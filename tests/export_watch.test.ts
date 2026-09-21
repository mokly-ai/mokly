import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { EXPORT_MARKER } from "../dist/export/ownership.js";
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
    "static/screens/home.mobile.html",
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
  const deadline = Date.now() + 2000;
  while (!events.includes(unowned) && Date.now() < deadline) await delay(25);
  assert.ok(
    events.includes(unowned),
    "an unlisted file must reach the real watcher",
  );
  assert.ok(!events.includes(path.join(fixture.output, "index.html")));
});
