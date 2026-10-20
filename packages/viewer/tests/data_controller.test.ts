import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

import { detailFixture, indexFixture } from "./catalogue_v7_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const HOME = "product/browse/home";
const OTHER = "1".repeat(64);

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

test("a detail from another deployment is reported and not installed", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/view/guide/");
  fixture.source
    .detail("guide")
    .resolve({ ...detailFixture({ path: "guide" }), deploymentId: OTHER });
  await flush();
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.commits.length, 0);
  assert.ok(fixture.controller.failed.has(detailKey({ path: "guide" })));
  assert.deepEqual(fixture.source.detailFailures, []);
});

test("a source that reloads on another deployment keeps the detail loading", async () => {
  const fixture = controllerFixture(indexFixture());
  fixture.source.reloadsOnDeployment = true;
  fixture.navigate("/view/guide/");
  fixture.source
    .detail("guide")
    .resolve({ ...detailFixture({ path: "guide" }), deploymentId: OTHER });
  await flush();
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.commits.length, 0);
  // The full page load replaces the document, so the stage keeps loading.
  assert.equal(
    fixture.controller.failed.has(detailKey({ path: "guide" })),
    false,
  );
  assert.deepEqual(fixture.source.detailFailures, []);
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
  const error = new MoklyVersionError("detail", 2, 1);
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

test("the home route requests no detail", () => {
  const fixture = controllerFixture(indexFixture());
  fixture.navigate("/");
  fixture.navigate("/view/nothing/");
  assert.equal(fixture.source.details.length, 0);
});
