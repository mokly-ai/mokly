import assert from "node:assert/strict";
import type fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { WatchEvent } from "../dist/server/watch_events.js";
import {
  rawRenamePaths,
  ResourceWatchNotifications,
} from "../dist/server/watch_notifications.js";

test("raw replacements identify only named watched resources, including file and directory notifications", () => {
  const directory = path.resolve("mockups/assets");
  const image = path.join(directory, "image.svg");
  const ignore = (candidate: string) => candidate !== image;
  for (const watchedPath of [directory, image]) {
    assert.deepEqual(rawRenamePaths("image.svg", { watchedPath }, ignore), [
      image,
    ]);
    assert.deepEqual(rawRenamePaths(image, { watchedPath }, ignore), [image]);
    assert.deepEqual(
      rawRenamePaths("generated.html", { watchedPath }, ignore),
      [],
    );
  }
});

test("unnamed raw events do not invent an entry or reload its parent", () => {
  for (const raw of [null, undefined, ""]) {
    assert.deepEqual(
      rawRenamePaths(raw, { watchedPath: path.resolve("mockups") }),
      [],
    );
  }
  assert.deepEqual(rawRenamePaths("image.svg", undefined), []);
});

test("normalized and raw events coalesce by path with the latest descriptor and cancel on shutdown", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const changes: WatchEvent[] = [];
  const latest: WatchEvent = {
    path: "image.svg",
    kind: "add",
    stats: { isDirectory: () => false } as fs.Stats,
  };
  const notifications = new ResourceWatchNotifications((candidate) =>
    changes.push(candidate),
  );
  notifications.notify({ path: "image.svg", kind: "raw" });
  context.mock.timers.tick(50);
  notifications.notify(latest);
  context.mock.timers.tick(74);
  assert.deepEqual(changes, []);
  context.mock.timers.tick(1);
  assert.deepEqual(changes, [latest]);
  notifications.notify({ path: "font.woff2", kind: "unlink" });
  notifications.close();
  context.mock.timers.tick(100);
  assert.deepEqual(changes, [latest]);
});
