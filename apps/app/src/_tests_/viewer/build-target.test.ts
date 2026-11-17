import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import type { Build } from "../../api/types";
import { requestTarget } from "../../viewer/build-target";
import { build } from "./build-fixtures";

const project = {
  id: "019a0000-0000-7000-8000-000000000001",
  workspaceSlug: "mokly-team",
  slug: "mokly-cloud",
};

function refused(reason: string, data?: unknown): ApiError {
  return new ApiError({
    code: "already-exists",
    reason,
    message: "Refused.",
    requestId: "01994f10-0000-7000-8000-0000000000bb",
    status: 409,
    data,
  });
}

test("a requested build opens its own details", async () => {
  const sent: unknown[] = [];
  const target = await requestTarget(
    project,
    { kind: "branch", name: "topic" },
    async (projectId, ref): Promise<Build> => {
      sent.push([projectId, ref]);
      return build({ id: "019a0000-0000-7000-8000-000000000b09" });
    },
  );
  assert.equal(
    target,
    "/mokly-team/mokly-cloud/builds/019a0000-0000-7000-8000-000000000b09",
  );
  assert.deepEqual(sent, [[project.id, { kind: "branch", name: "topic" }]]);
});

test("a head already publishing or published opens what answers for it", async () => {
  const active = await requestTarget(
    project,
    { kind: "pull-request", number: 4 },
    () =>
      Promise.reject(refused("build-already-active", { buildId: "b-active" })),
  );
  assert.equal(active, "/mokly-team/mokly-cloud/builds/b-active");
  const published = await requestTarget(
    project,
    { kind: "branch", name: "main" },
    () =>
      Promise.reject(
        refused("build-already-published", { publicationId: "p-ready" }),
      ),
  );
  assert.equal(published, "/mokly-team/mokly-cloud/publications/p-ready");
});

test("every other refusal is the control's to report", async () => {
  for (const reason of ["build-ineligible", "plan-required", "unavailable"]) {
    const error = refused(reason, { cause: "fork-pull-request" });
    await assert.rejects(
      requestTarget(project, { kind: "pull-request", number: 4 }, () =>
        Promise.reject(error),
      ),
      (caught) => caught === error,
    );
  }
});

test("a duplicate refusal without the build or publication it names is reported", async () => {
  for (const error of [
    refused("build-already-active"),
    refused("build-already-active", { buildId: "" }),
    refused("build-already-published", { publicationId: 7 }),
  ]) {
    await assert.rejects(
      requestTarget(project, { kind: "branch", name: "main" }, () =>
        Promise.reject(error),
      ),
      (caught) => caught === error,
    );
  }
});
