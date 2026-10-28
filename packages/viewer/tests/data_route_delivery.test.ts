import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detailKey,
  type DetailRequest,
} from "../src/catalogue/detail_fences.js";
import { routeDetailDelivery } from "../src/shell/data_requests.js";

import { detailFixture } from "./catalogue_v8_fixture.js";

const TOUR = { path: "tour" };
const STEP = { path: "product/browse/home" };
const VARIANT = { path: "components/action/default" };
const PARENT = { path: "components/action" };

/** The delivery of the tour route, whose details are all missing by default. */
function delivery(
  state: {
    held?: readonly DetailRequest[];
    failed?: readonly DetailRequest[];
    refreshFailed?: boolean;
    replaced?: boolean;
  },
  requests: readonly DetailRequest[] = [TOUR, STEP],
) {
  const retried: string[][] = [];
  const result = routeDetailDelivery({
    details: new Map(
      (state.held ?? []).map((request) => [
        detailKey(request),
        detailFixture(request),
      ]),
    ),
    failed: new Set((state.failed ?? []).map(detailKey)),
    refreshFailed: state.refreshFailed ?? false,
    replaced: state.replaced ?? false,
    requests,
    retry: (keys) => retried.push([...keys]),
    retryRefresh: () => retried.push(["refresh"]),
  });
  return { result, retried };
}

test("a route without details has no delivery", () => {
  assert.equal(delivery({ replaced: true }, []).result, undefined);
});

test("a route loads until every detail arrives, and a failed one offers a retry", () => {
  assert.deepEqual(delivery({}).result, { status: "loading" });
  assert.deepEqual(delivery({ held: [TOUR] }).result, { status: "loading" });
  assert.deepEqual(delivery({ held: [TOUR, STEP] }).result, {
    status: "ready",
  });
  const failed = delivery({ held: [TOUR], failed: [STEP] });
  assert.equal(failed.result?.status, "failed");
  if (failed.result?.status === "failed") failed.result.retry();
  assert.deepEqual(failed.retried, [[detailKey(TOUR), detailKey(STEP)]]);
  const refresh = delivery({ held: [TOUR, STEP], refreshFailed: true });
  assert.equal(refresh.result?.status, "failed");
  if (refresh.result?.status === "failed") refresh.result.retry();
  assert.deepEqual(refresh.retried, [["refresh"]]);
});

test("a component variant waits for its parent detail", () => {
  assert.deepEqual(delivery({}, [VARIANT, PARENT]).result, {
    status: "loading",
  });
  assert.deepEqual(delivery({ held: [VARIANT] }, [VARIANT, PARENT]).result, {
    status: "loading",
  });
  assert.deepEqual(
    delivery({ held: [VARIANT, PARENT] }, [VARIANT, PARENT]).result,
    { status: "ready" },
  );
  assert.equal(
    delivery({ held: [VARIANT], failed: [PARENT] }, [VARIANT, PARENT]).result
      ?.status,
    "failed",
  );
});

test("a use case shows a failed step only after every detail settles", () => {
  // The step failed while the use case detail still loads.
  assert.deepEqual(delivery({ failed: [STEP] }).result, { status: "loading" });
  // Once every detail arrived or failed, the route shows the failure.
  assert.equal(
    delivery({ held: [TOUR], failed: [STEP] }).result?.status,
    "failed",
  );
  assert.equal(delivery({ failed: [TOUR, STEP] }).result?.status, "failed");
  // Another deployment's catalogue settles the waiting detail as replaced.
  assert.deepEqual(delivery({ failed: [STEP], replaced: true }).result, {
    status: "replaced",
  });
});

test("a failed refresh fails a use case only after every detail settles", () => {
  // The refresh failed while the use case details still load.
  assert.deepEqual(delivery({ refreshFailed: true }).result, {
    status: "loading",
  });
  assert.deepEqual(delivery({ held: [TOUR], refreshFailed: true }).result, {
    status: "loading",
  });
  // Once every detail arrived or failed, the route offers the refresh again.
  for (const state of [
    { held: [TOUR, STEP], refreshFailed: true },
    { held: [TOUR], failed: [STEP], refreshFailed: true },
  ]) {
    const settled = delivery(state);
    assert.equal(settled.result?.status, "failed");
    if (settled.result?.status === "failed") settled.result.retry();
    assert.deepEqual(settled.retried, [["refresh"]]);
  }
});

test("another deployment's catalogue replaces a route that still waits for a detail", () => {
  assert.deepEqual(delivery({ replaced: true }).result, {
    status: "replaced",
  });
  // A step that failed is not shown as a failed route, and neither is a
  // publication refresh that failed.
  assert.deepEqual(
    delivery({ replaced: true, held: [TOUR], failed: [STEP] }).result,
    { status: "replaced" },
  );
  assert.deepEqual(
    delivery({ replaced: true, held: [TOUR], refreshFailed: true }).result,
    { status: "replaced" },
  );
  // A route whose details all arrived keeps the installed state.
  assert.deepEqual(
    delivery({ replaced: true, held: [TOUR, STEP], refreshFailed: true })
      .result,
    { status: "ready" },
  );
});
