import assert from "node:assert/strict";
import test from "node:test";

import {
  DelayedProgress,
  type ProgressTimers,
} from "../src/shell/rebuild_progress.js";
import {
  announcesFailure,
  initialAccountedFailure,
  REBUILD_FAILURE_ANNOUNCEMENT,
  REBUILD_PROGRESS_DELAY_MS,
  REBUILD_STATUS_COPY,
} from "../src/shell/rebuild_status_view.js";

/** A manual clock: timers fire only when a test advances it. */
class FakeTimers implements ProgressTimers {
  now = 0;
  #next = 1;
  readonly #timers = new Map<number, { at: number; callback: () => void }>();

  get pending(): number {
    return this.#timers.size;
  }

  clearTimeout(handle: number): void {
    this.#timers.delete(handle);
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const handle = this.#next++;
    this.#timers.set(handle, { at: this.now + delayMs, callback });
    return handle;
  }

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.#timers]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at)[0];
      if (!due) break;
      const [handle, timer] = due;
      this.#timers.delete(handle);
      this.now = timer.at;
      timer.callback();
    }
    this.now = target;
  }
}

function progress() {
  const timers = new FakeTimers();
  const changes: boolean[] = [];
  const controller = new DelayedProgress(timers, (visible) =>
    changes.push(visible),
  );
  return { changes, controller, timers };
}

test("the approved copy is product language with typographic punctuation", () => {
  assert.deepEqual(REBUILD_STATUS_COPY, {
    headline: "Your latest changes couldn’t be loaded.",
    explanation: "You’re seeing the last working version.",
    show: "Show details",
    hide: "Hide details",
    detailRegion: "Error details",
    progress: "Updating…",
  });
  assert.equal(
    REBUILD_FAILURE_ANNOUNCEMENT,
    "Your latest changes couldn’t be loaded. You’re seeing the last working version.",
  );
  for (const copy of Object.values(REBUILD_STATUS_COPY))
    assert.doesNotMatch(
      copy,
      /build|bundle|generation|rebuild|watch|serve|schema|sandbox|preview/i,
    );
  assert.equal(REBUILD_PROGRESS_DELAY_MS, 1_000);
});

test("a failure present at first paint is the baseline, never announced", () => {
  const failed = {
    failure: { detail: "entries/home.tsx failed", id: 4 },
    sequence: 5,
    updateVersion: 2,
    updating: true,
  } as const;
  assert.equal(initialAccountedFailure(undefined), 0);
  assert.equal(
    initialAccountedFailure({ ...failed, failure: null, sequence: 1 }),
    0,
  );
  const baseline = initialAccountedFailure(failed);
  assert.equal(baseline, 4);
  assert.equal(announcesFailure(baseline, 4), false, "replay of the same id");
  assert.equal(announcesFailure(baseline, undefined), false, "cleared");
  assert.equal(announcesFailure(baseline, 3), false, "an older id");
  assert.equal(announcesFailure(baseline, 9), true, "a replacement failure");
  assert.equal(announcesFailure(0, 2), true, "the first later failure");
});

test("progress shows only after exactly one second of updating", () => {
  const { changes, controller, timers } = progress();
  controller.observe(false);
  assert.equal(timers.pending, 0);
  controller.observe(true);
  timers.advance(999);
  assert.deepEqual(changes, []);
  timers.advance(1);
  assert.deepEqual(changes, [true]);
  controller.observe(false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(timers.pending, 0);
});

test("an update that ends before the delay never shows progress", () => {
  const { changes, controller, timers } = progress();
  controller.observe(true);
  timers.advance(600);
  controller.observe(false);
  timers.advance(10_000);
  assert.deepEqual(changes, []);
  assert.equal(timers.pending, 0);
});

test("a newer updating snapshot does not restart the delay", () => {
  const { changes, controller, timers } = progress();
  controller.observe(true);
  timers.advance(600);
  controller.observe(true);
  timers.advance(400);
  assert.deepEqual(changes, [true]);
});

test("an interrupted interval starts a fresh delay", () => {
  const { changes, controller, timers } = progress();
  controller.observe(true);
  timers.advance(900);
  controller.observe(false);
  controller.observe(true);
  timers.advance(999);
  assert.deepEqual(changes, []);
  timers.advance(1);
  assert.deepEqual(changes, [true]);
});

test("disposing the controller cancels a pending delay", () => {
  const { changes, controller, timers } = progress();
  controller.observe(true);
  controller.dispose();
  assert.equal(timers.pending, 0);
  timers.advance(5_000);
  assert.deepEqual(changes, []);
});
