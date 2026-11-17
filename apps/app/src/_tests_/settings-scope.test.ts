import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../api/errors";
import { missingSettingsScope } from "../settings/scope";
import {
  workspaceResourceScope,
  projectResourceScope,
  resourceInvalidationVersion,
} from "../data/resource-invalidation";

function failure(reason: string, status: number): ApiError {
  return new ApiError({
    code: status === 404 ? "not-found" : "internal",
    reason,
    message: "fixture",
    requestId: "request",
    status,
  });
}

test("missing or inaccessible settings scope is hidden", () => {
  assert.equal(missingSettingsScope(failure("not-found", 404)), true);
  assert.equal(missingSettingsScope(failure("permission-denied", 403)), true);
});

test("server, transport and untyped failures remain visible", () => {
  assert.equal(missingSettingsScope(failure("internal-error", 500)), false);
  assert.equal(missingSettingsScope(failure("unavailable", 0)), false);
  assert.equal(missingSettingsScope(new Error("network")), false);
});

test("resource invalidation is keyed to canonical workspace and project ids", () => {
  const workspace = workspaceResourceScope("org-1");
  const project = projectResourceScope("project-1");
  const generations = new Map([
    [workspace, 2],
    [project, 3],
    [projectResourceScope("project-2"), 9],
  ]);
  assert.equal(resourceInvalidationVersion(generations, [workspace]), 2);
  assert.equal(
    resourceInvalidationVersion(generations, [workspace, project]),
    5,
  );
  assert.equal(
    resourceInvalidationVersion(generations, [projectResourceScope("other")]),
    0,
  );

  const nextProjectGeneration = new Map(generations);
  nextProjectGeneration.set(project, 4);
  assert.notEqual(
    resourceInvalidationVersion(generations, [workspace, project]),
    resourceInvalidationVersion(nextProjectGeneration, [workspace, project]),
  );
});
