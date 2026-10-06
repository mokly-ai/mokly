import assert from "node:assert/strict";
import test from "node:test";

import { validateRenderRequest } from "../packages/mokly/dist/components/render_request.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("render requests merge only declared controls with lossless values and optional unset", async (t) => {
  const fixture = await componentReviewFixture(t, (value) => value);
  const request = {
    componentId: "action",
    variantPath: "action/disabled",
    viewport: "desktop",
    colorScheme: "light",
    generation: "generation",
    pageId: "a".repeat(32),
    overrides: {
      disabled: { kind: "unset" },
      label: { kind: "set", value: ["string", "Edited"] },
    },
  };
  const valid = validateRenderRequest(
    request,
    fixture.after.manifest,
    "generation",
  );
  assert.deepEqual(valid.props, { label: "Edited" });
  for (const overrides of [
    { label: { kind: "unset" } },
    { hidden: { kind: "set", value: ["boolean", true] } },
    { label: { kind: "set", value: ["number", "1"] } },
    { label: { kind: "set", value: ["string", "x".repeat(81)] } },
    { modulePath: { kind: "set", value: ["string", "bad"] } },
  ])
    assert.throws(
      () =>
        validateRenderRequest(
          { ...request, overrides },
          fixture.after.manifest,
          "generation",
        ),
      { code: "invalid-input" },
    );
  assert.throws(
    () =>
      validateRenderRequest(
        { ...request, extra: true },
        fixture.after.manifest,
        "generation",
      ),
    { code: "invalid-input" },
  );
  assert.throws(
    () => validateRenderRequest(request, fixture.after.manifest, "new"),
    { code: "stale-generation" },
  );
  assert.throws(
    () =>
      validateRenderRequest(
        { ...request, variantPath: "missing" },
        fixture.after.manifest,
        "generation",
      ),
    { code: "unknown-entry" },
  );
});
