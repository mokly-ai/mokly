import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detailKey,
  type DetailRequest,
} from "../src/catalogue/detail_fences.js";
import { routeDetailDelivery } from "../src/shell/data_requests.js";

import { detailFixture } from "./catalogue_v7_fixture.js";

const TOUR = { path: "tour" };
const STEP = { path: "product/browse/home" };

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
