import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueUsage } from "../src/catalogue/types.js";
import type { MountedFrame } from "../src/client/frame_adapter.js";
import { refreshFrameSessions } from "../src/viewer/frame_session.js";
import type { Session } from "../src/viewer/frame_session.js";
import type { ViewerFrame } from "../src/viewer/frame_views.js";

function sessionFixture(updateUsage?: MountedFrame["updateUsage"]) {
  const model = readCatalogue(
    JSON.parse(
      fs.readFileSync(
        new URL(
          "../../../docs/protocol/fixtures/catalogue-v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const entry = model.screens[0]!;
  const view = entry.views[0]!;
  const frame: ViewerFrame = {
    element: {} as HTMLIFrameElement,
    entry,
    view: { ...view, usage: { status: "pending" } },
    url: `/${view.fragmentPath}`,
  };
  const mounted: MountedFrame = {
    ...(updateUsage ? { updateUsage } : {}),
    listInstanceBoundaries: async () => [],
    highlight: async () => {},
    scrollTo: async () => {},
    subscribe: () => () => {},
    dispose: () => {},
  };
  const session: Session = {
    frame,
    usage: frame.view!.usage,
    controller: new AbortController(),
    mounted,
    ready: Promise.resolve(mounted),
  };
  const failures: unknown[] = [];
  const fail = (error: unknown) => {
    failures.push(error);
    return error as Error;
  };
  const next = (usage: CatalogueUsage): ViewerFrame => ({
    ...frame,
    view: { ...view, usage },
  });
  return { session, next, failures, fail, ready: view.usage };
}

test("adapters without usage updates retain replacement semantics", () => {
  const { session, next, ready, fail } = sessionFixture();
  assert.equal(refreshFrameSessions([session], [next(ready)], fail), false);
  assert.equal(session.usage!.status, "pending");
});

test("usage updates never retain a different document", () => {
  const { session, next, ready, fail } = sessionFixture(async () =>
    assert.fail("Must remount"),
  );
  assert.equal(
    refreshFrameSessions(
      [session],
      [{ ...next(ready), url: "/static/replacement.html" }],
      fail,
    ),
    false,
  );
});

for (const reject of [false, true]) {
  test(`cancelled usage update fences late ${reject ? "failure" : "success"}`, async () => {
    let finish!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const { session, next, ready, fail, failures } = sessionFixture(
      () =>
        new Promise<void>((resolve, fail) => {
          finish = () => (reject ? fail(new Error("Late failure")) : resolve());
          started();
        }),
    );
    assert.equal(refreshFrameSessions([session], [next(ready)], fail), true);
    await entered;
    const cancelled = assert.rejects(session.ready, { code: "disposed" });
    session.controller.abort();
    await cancelled;
    finish();
    await Promise.resolve();
    assert.deepEqual(failures, []);
  });
}

test("a later evidence update retries a current usage-update failure", async () => {
  let calls = 0;
  const error = new Error("Current failure");
  const { session, next, ready, fail, failures } = sessionFixture(async () => {
    if (++calls === 1) throw error;
  });
  refreshFrameSessions([session], [next(ready)], fail);
  await assert.rejects(session.ready, error);
  refreshFrameSessions([session], [next({ ...ready })], fail);
  await session.ready;
  assert.equal(calls, 2);
  assert.deepEqual(failures, [error]);
});
