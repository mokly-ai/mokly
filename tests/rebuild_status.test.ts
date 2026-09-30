import assert from "node:assert/strict";
import test from "node:test";

import type { RebuildStatus } from "@mokly/viewer/runtime";

import {
  WatchedRebuildStatus,
  type RebuildStatusPublisher,
} from "../dist/server/rebuild_status.js";
import { sanitizeRebuildFailure } from "../dist/server/rebuild_status_detail.js";
import type { ServeReporter } from "../dist/server/reporter.js";
import {
  completedWatchAction,
  failedWatchAction,
  WatchActionFailurePhase,
} from "../dist/server/watch_action_outcome.js";
import {
  WatchActionQueue,
  type RuntimeWatchAction,
} from "../dist/server/watch_events.js";
import { reportedWatchProcessor } from "../dist/server/watch_reporting.js";

test("source failure is replaced and only source success clears it", async () => {
  const publisher = new RecordingPublisher();
  const status = new WatchedRebuildStatus(publisher, () => "/repo");
  const sourceFailures = new Set<RuntimeWatchAction>(["rebuild"]);
  const deliveryFailures = new Set<RuntimeWatchAction>(["reload", "restart"]);
  const process = reportedWatchProcessor(
    async (action) => {
      if (sourceFailures.has(action))
        return failedWatchAction(
          WatchActionFailurePhase.Source,
          new Error(`${action} at /repo/src/app.ts`),
        );
      if (deliveryFailures.has(action))
        return failedWatchAction(
          WatchActionFailurePhase.Delivery,
          new Error(`${action} at /repo/src/app.ts`),
        );
      if (action === "rebuild" || action === "reconfigure") {
        publisher.version += 1;
        status.sourceSucceeded(publisher.version);
      }
      return completedWatchAction;
    },
    quietReporter(),
    () => "/repo",
    status,
  );
  const errors: unknown[] = [];
  const queue = new WatchActionQueue(process, errors.push.bind(errors), status);

  queue.notify("rebuild");
  await queue.settled();
  const failed = status.snapshot();
  assert.equal(failed.updating, false);
  assert.deepEqual(failed.failure, {
    detail: "rebuild at src/app.ts",
    id: failed.failure?.id,
  });
  const failureId = failed.failure?.id;

  queue.notify("reload");
  await queue.settled();
  assert.equal(status.snapshot().failure?.id, failureId);
  queue.notify("restart");
  await queue.settled();
  assert.equal(status.snapshot().failure?.id, failureId);
  queue.notify("rebuild");
  await queue.settled();
  assert.ok((status.snapshot().failure?.id ?? 0) > (failureId ?? 0));
  const replacementFailure = status.snapshot().failure;
  deliveryFailures.delete("reload");
  deliveryFailures.delete("restart");
  queue.notify("reload");
  await queue.settled();
  assert.deepEqual(status.snapshot().failure, replacementFailure);
  queue.notify("restart");
  await queue.settled();
  assert.deepEqual(status.snapshot().failure, replacementFailure);
  const beforeEvidence = publisher.snapshots.length;
  queue.notify("evidence");
  await queue.settled();
  assert.equal(publisher.snapshots.length, beforeEvidence);

  sourceFailures.delete("rebuild");
  queue.notify("rebuild");
  await queue.settled();
  assert.equal(status.snapshot().failure, null);
  assert.equal(status.snapshot().updateVersion, 2);
  sourceFailures.add("rebuild");
  queue.notify("rebuild");
  await queue.settled();
  assert.notEqual(status.snapshot().failure, null);
  queue.notify("reconfigure");
  await queue.settled();
  assert.equal(status.snapshot().failure, null);
  assert.equal(status.snapshot().updateVersion, 3);
  assert.equal(status.snapshot().updating, false);
  assert.deepEqual(errors, []);
});

test("queue progress stays active across qualifying queued work", async () => {
  const changes: boolean[] = [];
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const actions: string[] = [];
  const queue = new WatchActionQueue(
    async (action) => {
      actions.push(action);
      if (actions.length === 1) await blocked;
    },
    (error) => assert.fail(String(error)),
    { setUpdating: (updating) => changes.push(updating) },
  );
  queue.notify("reload");
  await new Promise((resolve) => setImmediate(resolve));
  queue.notify("evidence");
  queue.notify("restart");
  queue.notify("rebuild");
  assert.deepEqual(changes, [true]);
  release?.();
  await queue.settled();
  assert.deepEqual(actions, ["reload", "rebuild"]);
  assert.deepEqual(changes, [true, false]);
});

for (const [action, showsProgress, phase, replacesFailure] of [
  ["reconfigure", true, WatchActionFailurePhase.Source, true],
  ["rebuild", true, WatchActionFailurePhase.Source, true],
  ["restart", true, WatchActionFailurePhase.Delivery, false],
  ["reload", true, WatchActionFailurePhase.Delivery, false],
  ["evidence", false, WatchActionFailurePhase.Delivery, false],
  ["ignore", false, WatchActionFailurePhase.Delivery, false],
] as const) {
  test(`${action} follows the rebuild status action matrix`, async () => {
    const publisher = new RecordingPublisher();
    const status = new WatchedRebuildStatus(publisher, () => "/repo");
    status.sourceFailed(new Error("previous failure"));
    const previousFailure = status.snapshot().failure;
    const before = publisher.snapshots.length;
    const queue = new WatchActionQueue(
      reportedWatchProcessor(
        async () => failedWatchAction(phase, new Error(`${action} failed`)),
        quietReporter(),
        () => "/repo",
        status,
      ),
      (error) => assert.fail(String(error)),
      status,
    );
    queue.notify(action);
    await queue.settled();
    const published = publisher.snapshots.slice(before);
    assert.equal(
      published.some((snapshot) => snapshot.updating),
      showsProgress,
    );
    if (replacesFailure)
      assert.ok(
        (status.snapshot().failure?.id ?? 0) > (previousFailure?.id ?? 0),
      );
    else assert.deepEqual(status.snapshot().failure, previousFailure);
  });
}

test("failure detail strips terminal controls and rewrites absolute paths", () => {
  const raw =
    "\u001B]8;;https://example.test\u0007\u001B[31mFailed\u001B[0m\u001B]8;;\u001B\\\r\n" +
    "\t/repo/src/view.tsx:12:4 /tmp/private.ts C:\\secret\\file.ts:3 https://example.test/a";
  assert.equal(
    sanitizeRebuildFailure(new Error(raw), "/repo"),
    "Failed\n  src/view.tsx:12:4 <absolute path> <absolute path>:3 https://example.test/a",
  );
  assert.equal(sanitizeRebuildFailure("\u0000\t", "/repo"), FALLBACK);
});

test("failure detail preserves slash syntax and one-segment POSIX tokens", () => {
  assert.equal(
    sanitizeRebuildFailure(
      'Expected ">" but found "/" Unexpected "</h2>" a / b /tmp ' +
        "/tmp/private.ts /repo/src/view.tsx:12:4",
      "/repo",
    ),
    'Expected ">" but found "/" Unexpected "</h2>" a / b /tmp ' +
      "<absolute path> src/view.tsx:12:4",
  );
});

test("failure detail normalizes file URLs, Windows paths, UNC paths, and surrogates", () => {
  assert.equal(
    sanitizeRebuildFailure(
      "file:///repo/src/view.tsx:7 C:\\repo\\src\\win.ts:8 " +
        "\\\\server\\share\\private.ts file://server/share/private.ts " +
        "bad\ud800value",
      "/repo",
    ),
    "src/view.tsx:7 <absolute path>:8 <absolute path> <absolute path> bad�value",
  );
  assert.equal(
    sanitizeRebuildFailure(
      "C:\\repo\\src\\win.ts:8 file://server/share/src/unc.ts:9",
      "C:\\repo",
    ),
    "src/win.ts:8 <absolute path>:9",
  );
  assert.equal(
    sanitizeRebuildFailure(
      "\\\\server\\share\\src\\unc.ts:8 file://server/share/src/url.ts:9",
      "\\\\server\\share",
    ),
    "src/unc.ts:8 src/url.ts:9",
  );
});

test("failure detail bounds Unicode scalars and UTF-8 bytes without splitting", () => {
  const exact = "😀".repeat(2_048);
  assert.equal(sanitizeRebuildFailure(exact, "/repo"), exact);
  const bounded = sanitizeRebuildFailure(`${exact}x`, "/repo");
  assert.equal([...bounded].length, 2_048);
  assert.ok(Buffer.byteLength(bounded) <= 8_192);
  assert.match(bounded, /…$/u);
  assert.equal(
    sanitizeRebuildFailure("x".repeat(2_049), "/repo").length,
    2_048,
  );
});

const FALLBACK = "No additional details are available.";

class RecordingPublisher implements RebuildStatusPublisher {
  readonly snapshots: RebuildStatus[] = [];
  version = 1;

  currentUpdateVersion(): number {
    return this.version;
  }

  publishRebuildStatus(status: RebuildStatus): void {
    this.snapshots.push(structuredClone(status));
  }
}

function quietReporter(): ServeReporter {
  return {
    baselinePreparing() {},
    baselineReady() {},
    catalogueReady() {},
    changesReady() {},
    changesUnavailable() {},
    gitReferenceRefresh() {},
    runtimeDiagnostic() {},
    serveReady() {},
    watchFailed() {},
    watchFinished() {},
    watchStarted() {},
  };
}
