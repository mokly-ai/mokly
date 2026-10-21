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

test("every release derives a viewer tag from the shared CLI tag", () => {
  const input = {
    eventName: "push",
    releaseCreated: "true",
    releaseTag: "v0.16.0",
  };
  assert.deepEqual(resolvePublishRefs(input), {
    cli: "v0.16.0",
    viewer: "viewer-v0.16.0",
  });
  assert.equal(
    resolvePublishRefs({ ...input, releaseCreated: "false" }),
    undefined,
  );
  assert.deepEqual(
    resolvePublishRefs({
      eventName: "workflow_dispatch",
      manualRef: "v0.16.0",
    }),
    { cli: "v0.16.0", viewer: "viewer-v0.16.0" },
  );
  for (const tag of ["main", "latest", "v0.16.0; echo unsafe"])
    assert.throws(() =>
      resolvePublishRefs({
        eventName: "workflow_dispatch",
        manualRef: tag,
      }),
    );
});

async function taggedFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  await fs.mkdir(path.join(fixture.root, "packages/mokly"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixture.root, "packages/viewer"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.root, "packages/mokly/package.json"),
    JSON.stringify({ name: "@mokly/mokly", version: "0.8.0" }),
  );
  await fs.writeFile(
    path.join(fixture.root, "packages/viewer/package.json"),
    JSON.stringify({ name: "@mokly/viewer", version: "0.8.0" }),
  );
  await fixture.git("add", "packages");
  await fixture.git("commit", "-m", "test: shared release manifests");
  fixture.expectedCommit = await fixture.git("rev-parse", "HEAD");
  await fixture.git("tag", "v0.8.0");
  await fixture.git("tag", "-a", "viewer-v0.8.0", "-m", "test viewer tag");
  const remote = path.join(path.dirname(fixture.root), "origin.git");
  await execute("git", ["clone", "--bare", fixture.root, remote]);
  await fixture.git("remote", "add", "origin", remote);
  return { ...fixture, remote };
}

test("shared tags must match both package versions, origin, and clean checkout", async (t) => {
  const fixture = await taggedFixture(t);
  assert.equal(
    await verifyReleaseRefs(fixture.root, "v0.8.0"),
    fixture.expectedCommit,
  );
  await fs.writeFile(path.join(fixture.root, "untracked.txt"), "unreviewed");
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0"),
    /clean source/,
  );
  await fs.rm(path.join(fixture.root, "untracked.txt"));
  await execute("git", ["update-ref", "-d", "refs/tags/viewer-v0.8.0"], {
    cwd: fixture.remote,
  });
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0"),
    /origin does not contain/,
  );
});
