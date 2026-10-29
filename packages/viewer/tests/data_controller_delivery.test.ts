import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";
import {
  routeDetailDelivery,
  routeDetailRequests,
  routeKey,
} from "../src/shell/data_requests.js";
import type { ShellRoute } from "../src/shell/routes.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const HOME = "product/browse/home";
const OTHER = "1".repeat(64);
const GENERATION = "2".repeat(64);

/** The route delivery as the shell store computes it from the controller. */
function deliveryOf(
  fixture: ReturnType<typeof controllerFixture>,
  route: ShellRoute,
) {
  const controller = fixture.controller;
  return routeDetailDelivery({
    details: controller.snapshot.details,
    failed: controller.failed,
    refreshFailed: controller.refreshFailed === routeKey(route),
    replaced: controller.replaced,
    requests: routeDetailRequests(controller.snapshot.index, route),
    retry: () => undefined,
    retryRefresh: () => undefined,
  });
}

test("a step that fails first is reported at once while the use case waits for its other details", async () => {
  const fixture = controllerFixture(indexFixture());
  const route = fixture.navigate("/view/tour/");
  fixture.source.detail(HOME).reject(new Error("Not found"));
  await flush();
  // The host hears of the failure at once, but the stage keeps loading
  // while the use case detail and the other step still load.
  assert.deepEqual(fixture.source.detailFailures, [{ path: HOME }]);
  assert.deepEqual(deliveryOf(fixture, route), { status: "loading" });
  fixture.source.detail("tour").resolve({
    ...detailFixture({ path: "tour" }),
    revision: 0,
    detailId: OTHER,
  });
  await flush();
  assert.deepEqual(deliveryOf(fixture, route), { status: "replaced" });
  assert.equal(fixture.source.deploymentChanges, 1);
});

test("a failed refresh keeps a use case loading while its details load", async () => {
  const live = indexFixture((raw) => {
    raw.revision = 1;
    raw.live = { generation: GENERATION };
  });
  const fixture = controllerFixture(live, { live: true });
  fixture.controller.connect();
  const route = fixture.navigate("/view/tour/");
  // A publication refresh fails while the use case and its steps load.
  fixture.live.listener!.message(2, live.deploymentId);
  fixture.source.index().reject(new Error("offline"));
  await flush();
  assert.equal(fixture.controller.refreshFailed, routeKey(route));
  assert.deepEqual(deliveryOf(fixture, route), { status: "loading" });
  // A detail of another deployment then replaces the catalogue.
  fixture.source.detail("tour").resolve({
    ...detailFixture({ path: "tour" }),
    revision: 1,
    detailId: OTHER,
  });
  await flush();
  assert.deepEqual(deliveryOf(fixture, route), { status: "replaced" });
});

test("a newer detail installs with the refetched index of its revision", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate(`/view/${HOME}/`);
  fixture.navigate("/view/tour/");
  const pending = fixture.source.details.filter((item) => !item.signal.aborted);
  fixture.source
    .detail("tour")
    .resolve({ ...detailFixture({ path: "tour" }), revision: 1 });
  await flush();
  const newer = indexFixture((raw) => (raw.revision = 1));
  fixture.source.index().resolve(newer);
  await flush();
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.snapshot.index, newer);
  assert.deepEqual(
    [...fixture.controller.snapshot.details.keys()],
    [detailKey({ path: "tour" })],
  );
  assert.ok(
    pending
      .filter((item) => item.input.path !== "tour")
      .every((item) => item.signal.aborted),
  );
});

test("a detail of a newer format reports a version error", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/view/guide/");
  const error = new MoklyVersionError("detail", 5, 4);
  fixture.source.detail("guide").reject(error);
  await flush();
  assert.deepEqual(fixture.versionErrors, [error]);
  assert.equal(fixture.commits.length, 0);
});

test("a static index neither subscribes nor loads a descriptor", () => {
  const fixture = controllerFixture(indexFixture(), { live: true });
  const disconnect = fixture.controller.connect();
  assert.equal(fixture.live.subscriptions, 0);
  assert.equal(fixture.live.descriptors.length, 0);
  assert.equal(fixture.controller.live, undefined);
  disconnect();
});

test("Serve does not request a deployment file", () => {
  const fixture = controllerFixture(indexFixture(), { live: true });
  fixture.navigate("/view/guide/");
  assert.equal(fixture.source.deployments.length, 0);
});

test("the home route requests no detail", () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/");
  fixture.navigate("/view/nothing/");
  assert.equal(fixture.source.details.length, 0);
});
