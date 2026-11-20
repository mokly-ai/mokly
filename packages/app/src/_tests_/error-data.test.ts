import assert from "node:assert/strict";
import { test } from "node:test";

import { apiDataReasons, parseErrorData } from "../api/error-data";
import type { ApiErrorData } from "../api/error-data";

const uuid = "019a0000-0000-7000-8000-000000000001";

/** The data each reason carries, exactly as the generated contract types it. */
const carried: ApiErrorData = {
  "version-conflict": { currentVersion: 2 },
  "duplicate-project": { existingProjectId: uuid },
  "plan-required": { requiredPlan: "team", feature: "private-projects" },
  "slug-taken": { field: "slug", suggestedSlug: "mokly-team-2" },
  "slug-reserved": { field: "slug", suggestedSlug: "mokly-team-2" },
  "build-ineligible": { cause: "fork-pull-request" },
  "build-already-active": { buildId: uuid },
  "build-already-published": { publicationId: uuid },
};

test("every reason that carries data reads the type the contract gives it", () => {
  assert.deepEqual([...apiDataReasons].sort(), Object.keys(carried).sort());
  for (const [reason, data] of Object.entries(carried))
    assert.deepEqual(parseErrorData(reason, data), { [reason]: data });
});

test("data whose values have another type is dropped, not assumed", () => {
  const malformed: [string, unknown][] = [
    ["version-conflict", { currentVersion: "2" }],
    ["version-conflict", { currentVersion: 2.5 }],
    ["duplicate-project", { existingProjectId: 7 }],
    ["duplicate-project", { existingProjectId: "" }],
    ["plan-required", { requiredPlan: "enterprise", feature: "sso" }],
    ["plan-required", { requiredPlan: "team" }],
    ["slug-taken", { field: "name", suggestedSlug: "mokly-team-2" }],
    ["slug-reserved", { field: "slug", suggestedSlug: "" }],
    ["build-ineligible", { cause: "draft-pull-request" }],
    ["build-already-active", { buildId: null }],
    ["build-already-published", { buildId: uuid }],
  ];
  for (const [reason, data] of malformed)
    assert.deepEqual(parseErrorData(reason, data), {}, reason);
});

test("only the fields of the reason's own type are kept", () => {
  assert.deepEqual(
    parseErrorData("build-already-active", {
      buildId: uuid,
      cause: "fork-pull-request",
    }),
    { "build-already-active": { buildId: uuid } },
  );
});

test("data on a reason that carries none, or that is not an object, is ignored", () => {
  for (const [reason, data] of [
    ["not-found", { currentVersion: 2 }],
    ["brand-new", { currentVersion: 2 }],
    ["version-conflict", undefined],
    ["version-conflict", null],
    ["version-conflict", "2"],
    ["version-conflict", [2]],
  ] as const)
    assert.deepEqual(parseErrorData(reason, data), {}, reason);
});
