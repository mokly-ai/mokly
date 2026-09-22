import assert from "node:assert/strict";
import type fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { WatchEvent } from "../dist/server/watch_events.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import { mockChokidar } from "./helpers/chokidar_watcher.js";

for (const followSymlinks of [true, false]) {
  test(`chokidar preserves event kinds and stats (followSymlinks=${followSymlinks})`, async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const emitter = mockChokidar(context);
    const watcher = new ChokidarWatcherFactory().create([], undefined, {
      followSymlinks,
    });
    context.after(() => watcher.close());
    const received: WatchEvent[] = [];
    watcher.onChange((event) => received.push(event));
    await watcher.ready();
    for (const kind of [
      "add",
      "addDir",
      "change",
      "unlink",
      "unlinkDir",
    ] as const) {
      const candidate = path.resolve(`input/${kind}`);
      const stats = { isDirectory: () => kind === "addDir" } as fs.Stats;
      emitter.emit("all", kind, candidate, stats);
      context.mock.timers.tick(75);
      assert.deepEqual(received.at(-1), { path: candidate, kind, stats });
    }
    assert.equal(received.length, 5);
  });
}

test("resource rename fallback delivers raw descriptors without stats", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const emitter = mockChokidar(context);
  const directory = path.resolve("public");
  const candidate = path.join(directory, "image.svg");
  const watcher = new ChokidarWatcherFactory().create(
    [directory],
    (value) => value !== candidate,
    { followSymlinks: false },
  );
  context.after(() => watcher.close());
  const received: WatchEvent[] = [];
  watcher.onChange((event) => received.push(event));
  await watcher.ready();
  emitter.emit("raw", "rename", "image.svg", { watchedPath: directory });
  context.mock.timers.tick(75);
  assert.deepEqual(received, [{ path: candidate, kind: "raw" }]);
});
