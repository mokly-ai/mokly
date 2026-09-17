import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
interface ReleaseSelection {
  eventName: string;
  manualRef: string;
  manualViewerRef: string;
  releaseCreated: string;
  releaseTag: string;
  viewerReleaseCreated: string;
  viewerReleaseTag: string;
}

test("paired release selection rejects incomplete, floating and colliding tags", async () => {
  const { resolvePublishRefs } = (await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/release/context.mjs")).href
  )) as {
    resolvePublishRefs(
      input: ReleaseSelection,
    ): { cli: string; viewer: string } | undefined;
  };
  const input = {
    eventName: "push",
    manualRef: "",
    manualViewerRef: "",
    releaseCreated: "true",
    releaseTag: "v0.10.0",
    viewerReleaseCreated: "true",
    viewerReleaseTag: "viewer-v0.1.0",
  };
  assert.deepEqual(resolvePublishRefs(input), {
    cli: "v0.10.0",
    viewer: "viewer-v0.1.0",
  });
  assert.equal(
    resolvePublishRefs({
      ...input,
      releaseCreated: "false",
      viewerReleaseCreated: "false",
    }),
    undefined,
  );
  assert.throws(
    () => resolvePublishRefs({ ...input, releaseCreated: "false" }),
    /paired CLI/,
  );
  assert.throws(
    () => resolvePublishRefs({ ...input, viewerReleaseCreated: "false" }),
    /viewer_ref/,
  );
  const manual = {
    ...input,
    eventName: "workflow_dispatch",
    manualRef: input.releaseTag,
    manualViewerRef: input.viewerReleaseTag,
  };
  assert.deepEqual(resolvePublishRefs(manual), {
    cli: "v0.10.0",
    viewer: "viewer-v0.1.0",
  });
  for (const ref of [
    "",
    "main",
    "v0.1.0",
    "viewer-v01.0.0",
    "viewer-v0.1.0\nother",
    "viewer-v0.1.0; echo unsafe",
  ])
    assert.throws(() =>
      resolvePublishRefs({ ...manual, manualViewerRef: ref }),
    );
});

async function refsModule(): Promise<{
  verifyReleaseRefs(root: string, cli: string, viewer: string): Promise<string>;
}> {
  return await import(
    pathToFileURL(path.join(repositoryRoot, "scripts/release/refs.mjs")).href
  );
}

async function taggedFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  await fixture.git("tag", "v0.8.0");
  await fixture.git("tag", "-a", "viewer-v0.1.0", "-m", "test viewer tag");
  const remote = path.join(path.dirname(fixture.root), "origin.git");
  await execute("git", ["clone", "--bare", fixture.root, remote]);
  await fixture.git("remote", "add", "origin", remote);
  return { ...fixture, remote };
}

test("both local and remote tags must match the clean checkout and exact package pair", async (t) => {
  const fixture = await taggedFixture(t);
  const { verifyReleaseRefs } = await refsModule();
  const verify = () =>
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0");
  assert.equal(await verify(), fixture.expectedCommit);
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.2.0"),
    /does not match package version/,
  );
  await fs.writeFile(path.join(fixture.root, "untracked.txt"), "unreviewed");
  await assert.rejects(verify(), /clean source/);
  await fixture.git("add", "untracked.txt");
  await assert.rejects(verify(), /clean source/);
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: other commit",
  );
  await assert.rejects(verify(), /one commit/);
});

test("remote viewer tag deletion fails closed even with a valid local pair", async (t) => {
  const fixture = await taggedFixture(t);
  await execute("git", ["update-ref", "-d", "refs/tags/viewer-v0.1.0"], {
    cwd: fixture.remote,
  });
  const { verifyReleaseRefs } = await refsModule();
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /origin does not contain/,
  );
});
