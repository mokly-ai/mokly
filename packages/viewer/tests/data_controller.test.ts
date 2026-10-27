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

import { detailFixture, indexFixture } from "./catalogue_v8_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const HOME = "product/browse/home";
const OTHER = "1".repeat(64);
const GENERATION = "2".repeat(64);

/** The route's delivery as the shell store computes it from the controller. */
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

test("navigation fetches the destination's detail and adopts it in one commit", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  assert.equal(fixture.commits.length, 1);
  assert.ok(fixture.controller.snapshot.details.has(detailKey({ path: HOME })));
  assert.equal(fixture.commits[0], fixture.controller.snapshot);
  fixture.navigate(`/view/${HOME}/`);
  assert.equal(fixture.source.details.length, 1);
  fixture.navigate("/view/guide/");
  assert.deepEqual(
    fixture.source.details.map((item) => item.input),
    [{ path: HOME }, { path: "guide" }],
  );
  assert.equal(fixture.source.indexes.length, 0);
});

test("static navigation checks one deployment file per page change", async () => {
  const index = indexFixture();
  const fixture = controllerFixture(index, { static: true });
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  fixture.navigate("/view/guide/");
  assert.equal(fixture.source.deployments.length, 1);
  fixture.source.deployment().resolve({
    schemaVersion: 1,
    deploymentId: index.deploymentId,
  });
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  assert.equal(fixture.source.deployments.length, 1);
});

test("a changed static deployment reports replaced status", async () => {
  const index = indexFixture();
  const fixture = controllerFixture(index, { static: true });
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  fixture.navigate("/view/guide/");
  fixture.source.deployment().resolve({
    schemaVersion: 1,
    deploymentId: OTHER,
  });
  await flush();
  assert.equal(fixture.controller.replaced, true);
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.controller.failed.size, 0);
});

test("a failed detail is suppressed when the deployment check replaces it", async () => {
  const index = indexFixture();
  const fixture = controllerFixture(index, { static: true });
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  fixture.navigate("/view/guide/");
  fixture.source.detail("guide").reject(new Error("offline"));
  fixture.source.deployment().resolve({
    schemaVersion: 1,
    deploymentId: OTHER,
  });
  await flush();
  assert.equal(fixture.controller.replaced, true);
  assert.deepEqual(fixture.source.detailFailures, []);
});

test("a failed static deployment file changes nothing", async () => {
  const index = indexFixture();
  const fixture = controllerFixture(index, { static: true });
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  fixture.navigate("/view/guide/");
  fixture.source.deployment().reject(new Error("missing"));
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  assert.equal(fixture.controller.replaced, false);
  assert.ok(
    fixture.controller.snapshot.details.has(detailKey({ path: "guide" })),
  );
});

test("navigating away aborts the load the new route no longer wants", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate(`/view/${HOME}/`);
  const first = fixture.source.detail(HOME);
  fixture.navigate("/view/guide/");
  assert.equal(first.signal.aborted, true);
  first.resolve(detailFixture({ path: HOME }));
  await flush();
  assert.equal(fixture.commits.length, 0);
  fixture.navigate(`/view/${HOME}/`);
  assert.equal(fixture.source.details.length, 3);
});

test("a failed detail stays unavailable until a retry", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/view/guide/");
  fixture.source.detail("guide").reject(new Error("offline"));
  await flush();
  const key = detailKey({ path: "guide" });
  assert.ok(fixture.controller.failed.has(key));
  assert.equal(fixture.commits.length, 0);
  assert.deepEqual(fixture.source.detailFailures, [{ path: "guide" }]);
  fixture.navigate("/view/guide/");
  assert.equal(fixture.source.details.length, 1);
  fixture.controller.retry([key]);
  assert.equal(fixture.controller.failed.has(key), false);
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  assert.equal(fixture.commits.length, 1);
});

test("a detail from another deployment is reported once and keeps loading", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/view/guide/");
  fixture.source
    .detail("guide")
    .resolve({ ...detailFixture({ path: "guide" }), deploymentId: OTHER });
  await flush();
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.commits.length, 0);
  // A full page load or the host's new index replaces the data, so the
  // detail is neither installed nor failed, and the stage keeps loading.
  assert.equal(
    fixture.controller.failed.has(detailKey({ path: "guide" })),
    false,
  );
  assert.deepEqual(fixture.source.detailFailures, []);
});

test("a step that fails after another deployment answered leaves the use case replaced", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/view/tour/");
  const steps = fixture.source.details.filter(
    (item) => item.input.path !== "tour",
  );
  assert.equal(steps.length, 2);
  fixture.source
    .detail("tour")
    .resolve({ ...detailFixture({ path: "tour" }), deploymentId: OTHER });
  await flush();
  assert.equal(fixture.controller.replaced, true);
  assert.equal(fixture.source.deploymentChanges, 1);
  // A full page load or the host's new index brings the new data, so the
  // step loads stop, and a step that fails afterwards is not a failed route.
  assert.ok(steps.every((step) => step.signal.aborted));
  for (const step of steps) step.reject(new Error("Not found"));
  await flush();
  assert.equal(fixture.controller.failed.size, 0);
  assert.deepEqual(fixture.source.detailFailures, []);
  // A later route waits for the new data too, and requests nothing.
  fixture.navigate("/view/guide/");
  fixture.controller.retry([detailKey({ path: "guide" })]);
  assert.equal(fixture.source.details.length, 3);
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.commits.length, 0);
});

test("a step that fails first is reported at once while the use case waits for its other details", async () => {
  const fixture = controllerFixture(indexFixture());
  const route = fixture.navigate("/view/tour/");
  fixture.source.detail(HOME).reject(new Error("Not found"));
  await flush();
  // The host hears of the failure at once, but the stage keeps loading
  // while the use case detail and the other step still load.
  assert.deepEqual(fixture.source.detailFailures, [{ path: HOME }]);
  assert.deepEqual(deliveryOf(fixture, route), { status: "loading" });
  fixture.source
    .detail("tour")
    .resolve({ ...detailFixture({ path: "tour" }), deploymentId: OTHER });
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
  fixture.source
    .detail("tour")
    .resolve({ ...detailFixture({ path: "tour" }), deploymentId: OTHER });
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
  const error = new MoklyVersionError("detail", 3, 2);
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
