import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
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

const resolveRefScript = path.join(
  repositoryRoot,
  "scripts/release/resolve-ref.mjs",
);

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

test("release selection entrypoint writes the verification mode for each event", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/release-ref-"),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const shared = {
    MANUAL_REF: "",
    MANUAL_VERIFICATION: "",
    MANUAL_VIEWER_REF: "",
    RELEASE_CREATED: "true",
    RELEASE_TAG: "v0.10.0",
    VIEWER_RELEASE_CREATED: "true",
    VIEWER_RELEASE_TAG: "viewer-v0.1.0",
  };
  assert.deepEqual(
    await resolveRefOutputs(root, {
      ...shared,
      RELEASE_EVENT: "push",
      MANUAL_VERIFICATION: "complete",
    }),
    {
      publish_ref: "v0.10.0",
      viewer_ref: "viewer-v0.1.0",
      verification: "evidence",
    },
  );
  assert.deepEqual(
    await resolveRefOutputs(root, {
      ...shared,
      RELEASE_EVENT: "workflow_dispatch",
      MANUAL_REF: "v0.10.0",
      MANUAL_VERIFICATION: "complete",
      MANUAL_VIEWER_REF: "viewer-v0.1.0",
    }),
    {
      publish_ref: "v0.10.0",
      viewer_ref: "viewer-v0.1.0",
      verification: "complete",
    },
  );
  await assert.rejects(
    resolveRefOutputs(root, {
      ...shared,
      RELEASE_EVENT: "workflow_dispatch",
      MANUAL_REF: "v0.10.0",
      MANUAL_VERIFICATION: "skip",
      MANUAL_VIEWER_REF: "viewer-v0.1.0",
    }),
    /unsupported release verification mode/,
  );
});

async function resolveRefOutputs(
  root: string,
  environment: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const output = path.join(root, `output-${randomUUID()}`);
  await execute(process.execPath, [resolveRefScript], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment, GITHUB_OUTPUT: output },
  });
  const lines = (await fs.readFile(output, "utf8")).trim().split("\n");
  return Object.fromEntries(lines.map((line) => line.split("=", 2)));
}

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
