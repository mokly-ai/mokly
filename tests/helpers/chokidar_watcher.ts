import { EventEmitter } from "node:events";
import type { TestContext } from "node:test";

import chokidar, { type FSWatcher } from "chokidar";

/** Emit real adapter notifications without relying on operating-system timing. */
export function mockChokidar(context: TestContext): FSWatcher {
  const watcher = new EventEmitter() as FSWatcher;
  watcher.close = async () => undefined;
  context.mock.method(chokidar, "watch", () => {
    queueMicrotask(() => watcher.emit("ready"));
    return watcher;
  });
  return watcher;
}
