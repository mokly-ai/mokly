import assert from "node:assert/strict";
import test from "node:test";

import {
  WatchDebouncer,
  type DebounceClock,
} from "../dist/server/watch_events.js";

test("a changed debounce setting retains both old and new pending paths", () => {
  let delay = 75;
  const durations: number[] = [];
  let pending: (() => void) | undefined;
  const handle = {} as ReturnType<typeof setTimeout>;
  const clock: DebounceClock = {
    clear: () => {
      pending = undefined;
    },
    schedule: (callback, milliseconds) => {
      pending = callback;
      durations.push(milliseconds);
      return handle;
    },
  };
  const actions: { action: string; paths: readonly string[] }[] = [];
  const debouncer = new WatchDebouncer(
    () => delay,
    (action, paths) => actions.push({ action, paths }),
    clock,
  );
  debouncer.notify("reload", "old.css");
  delay = 150;
  debouncer.notify("rebuild", "new.ts");
  assert.deepEqual(durations, [75, 150]);
  pending?.();
  assert.deepEqual(actions, [
    { action: "rebuild", paths: ["old.css", "new.ts"] },
  ]);
  debouncer.close();
});
