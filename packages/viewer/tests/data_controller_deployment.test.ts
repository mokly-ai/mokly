import assert from "node:assert/strict";
import { test } from "node:test";

import { detailFixture, indexFixture } from "./catalogue_v8_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush } from "./data_fakes.js";

const HOME = "product/browse/home";

test("a use-case step click keeps its deployment check", async () => {
  const fixture = controllerFixture(indexFixture(), { static: true });
  fixture.navigate("/view/guide/");
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  fixture.navigate("/view/tour/");
  const deployment = fixture.source.deployment();
  fixture.navigate(`/view/${HOME}/`);
  assert.equal(deployment.signal.aborted, false);
});

test("a repeated call after a detail commit keeps its deployment check", async () => {
  const fixture = controllerFixture(indexFixture(), { static: true });
  fixture.navigate("/view/guide/");
  fixture.source.detail("guide").resolve(detailFixture({ path: "guide" }));
  await flush();
  fixture.navigate("/view/tour/");
  fixture.source.detail(HOME).resolve(detailFixture({ path: HOME }));
  await flush();
  const deployment = fixture.source.deployment();
  fixture.navigate("/view/tour/");
  assert.equal(deployment.signal.aborted, false);
});

test("a StrictMode replay of the first request does not check deployment", () => {
  const fixture = controllerFixture(indexFixture(), { static: true });
  fixture.navigate(`/view/${HOME}/`);
  fixture.controller.abortLoads();
  fixture.controller.request([{ path: HOME }]);
  assert.equal(fixture.source.deployments.length, 0);
});
