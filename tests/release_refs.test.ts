import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { resolvePublishRefs } from "../scripts/release/context.mjs";
import { verifyReleaseRefs } from "../scripts/release/refs.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";

const execute = promisify(execFile);

test("viewer releases select immutable tags without a CLI release", () => {
  const input = {
    eventName: "push",
    viewerReleaseCreated: "true",
    viewerReleaseTag: "viewer-v0.1.0",
  };
  assert.deepEqual(resolvePublishRefs(input), { viewer: "viewer-v0.1.0" });
  assert.equal(
    resolvePublishRefs({ ...input, viewerReleaseCreated: "false" }),
    undefined,
  );
  assert.deepEqual(
    resolvePublishRefs({
      eventName: "workflow_dispatch",
      manualViewerRef: "viewer-v0.2.0",
    }),
    { viewer: "viewer-v0.2.0" },
  );
  for (const tag of ["main", "latest", "v0.1.0", "viewer-v01.1.0", ""])
    assert.throws(() =>
      resolvePublishRefs({
        eventName: "workflow_dispatch",
        manualViewerRef: tag,
      }),
    );
});

async function taggedFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  await fixture.git("tag", "-a", "viewer-v0.1.0", "-m", "test viewer tag");
  const remote = path.join(path.dirname(fixture.root), "origin.git");
  await execute("git", ["clone", "--bare", fixture.root, remote]);
  await fixture.git("remote", "add", "origin", remote);
  return { ...fixture, remote };
}

test("viewer tags must match the package version, origin, and clean checkout", async (t) => {
  const fixture = await taggedFixture(t);
  assert.equal(
    await verifyReleaseRefs(fixture.root, "viewer-v0.1.0"),
    fixture.expectedCommit,
  );
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "viewer-v0.2.0"),
    /does not match package version/,
  );
  await fs.writeFile(path.join(fixture.root, "untracked.txt"), "unreviewed");
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "viewer-v0.1.0"),
    /clean source/,
  );
});

test("a missing remote viewer tag fails closed", async (t) => {
  const fixture = await taggedFixture(t);
  await execute("git", ["update-ref", "-d", "refs/tags/viewer-v0.1.0"], {
    cwd: fixture.remote,
  });
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "viewer-v0.1.0"),
    /origin does not contain/,
  );
});
