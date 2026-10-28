import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";

import { detailFixture, indexFixture } from "./catalogue_v8_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const HOME = "product/browse/home";
const OTHER = "1".repeat(64);
const SECOND_VARIANT = "components/action/second";

function indexWithSecondVariant() {
  return indexFixture((index) => {
    const original = index.components.find(
      (entry) => entry.path === "components/action/default",
    )!;
    index.components = [
      ...index.components,
      {
        ...structuredClone(original),
        path: SECOND_VARIANT,
        title: "Second",
        views: original.views.map((view) => structuredClone(view)),
      },
    ];
    const componentFolder = index.tree.find(
      (node) => node.kind === "folder" && node.path === "components",
    );
    const actionNode = componentFolder?.children?.find(
      (node) => node.kind === "entry" && node.path === "components/action",
    );
    if (actionNode?.kind === "entry")
      actionNode.children = [
        ...(actionNode.children ?? []),
        { kind: "entry", path: SECOND_VARIANT },
      ];
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

test("a sibling variant keeps its held parent detail", async () => {
  const fixture = controllerFixture(indexWithSecondVariant());
  fixture.navigate("/view/components/action/default/");
  const firstVariant = fixture.source.detail("components/action/default");
  const parent = fixture.source.detail("components/action");
  parent.resolve(detailFixture({ path: "components/action" }));
  await flush();

  fixture.navigate(`/view/${SECOND_VARIANT}/`);

  assert.equal(firstVariant.signal.aborted, true);
  assert.ok(
    fixture.controller.snapshot.details.has(
      detailKey({ path: "components/action" }),
    ),
  );
  assert.deepEqual(
    fixture.source.details.map((item) => item.input),
    [
      { path: "components/action/default" },
      { path: "components/action" },
      { path: SECOND_VARIANT },
    ],
  );
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
    .resolve({ ...detailFixture({ path: "guide" }), detailId: OTHER });
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
  fixture.source.detail("tour").resolve({
    ...detailFixture({ path: "tour" }),
    revision: 0,
    detailId: OTHER,
  });
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
