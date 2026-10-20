import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { resolvePublishRefs } from "../scripts/release/context.mjs";
import { verifyReleaseRefs } from "../scripts/release/refs.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);

test("releases accept a root CLI tag with an optional new viewer tag", () => {
  const input = {
    eventName: "push",
    releaseCreated: "true",
    releaseTag: "v0.8.0",
    viewerReleaseCreated: "true",
    viewerReleaseTag: "viewer-v0.1.0",
  };
  assert.deepEqual(resolvePublishRefs(input), {
    cli: "v0.8.0",
    viewer: "viewer-v0.1.0",
  });
  assert.throws(
    () => resolvePublishRefs({ ...input, releaseCreated: "false" }),
    /requires the root CLI/,
  );
  assert.deepEqual(
    resolvePublishRefs({ ...input, viewerReleaseCreated: "false" }),
    { cli: "v0.8.0", viewer: "" },
  );
  assert.equal(
    resolvePublishRefs({
      ...input,
      releaseCreated: "false",
      viewerReleaseCreated: "false",
    }),
    undefined,
  );
  assert.deepEqual(
    resolvePublishRefs({
      eventName: "workflow_dispatch",
      manualRef: "v0.8.0",
      manualViewerRef: "viewer-v0.2.0",
    }),
    { cli: "v0.8.0", viewer: "viewer-v0.2.0" },
  );
  for (const tag of [
    "main",
    "latest",
    "v0.1.0",
    "viewer-v01.1.0",
    "viewer-v0.1.0\nother",
    "viewer-v0.1.0; echo unsafe",
  ])
    assert.throws(() =>
      resolvePublishRefs({
        eventName: "workflow_dispatch",
        manualRef: "v0.8.0",
        manualViewerRef: tag,
      }),
    );
});

async function taggedFixture(t: test.TestContext) {
  const fixture = await bootstrapFixture(t);
  await fs.mkdir(path.join(fixture.root, "packages/mokly"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.root, "packages/mokly/package.json"),
    JSON.stringify({ name: "@mokly/mokly", version: "0.8.0" }),
  );
  await fixture.git("add", "packages/mokly");
  await fixture.git("commit", "-m", "test: CLI manifest");
  fixture.expectedCommit = await fixture.git("rev-parse", "HEAD");
  await fixture.git("tag", "v0.8.0");
  await fixture.git("tag", "-a", "viewer-v0.1.0", "-m", "test viewer tag");
  const remote = path.join(path.dirname(fixture.root), "origin.git");
  await execute("git", ["clone", "--bare", fixture.root, remote]);
  await fixture.git("remote", "add", "origin", remote);
  return { ...fixture, remote };
}

test("viewer tags must match the package version, origin, and clean checkout", async (t) => {
  const fixture = await taggedFixture(t);
  assert.equal(
    await verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    fixture.expectedCommit,
  );
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.2.0"),
    /does not match package version/,
  );
  await fs.writeFile(path.join(fixture.root, "untracked.txt"), "unreviewed");
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /clean source/,
  );
  await fixture.git("add", "untracked.txt");
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /clean source/,
  );
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: other commit",
  );
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /one commit/,
  );
});

test("a missing remote viewer tag fails closed", async (t) => {
  const fixture = await taggedFixture(t);
  await execute("git", ["update-ref", "-d", "refs/tags/viewer-v0.1.0"], {
    cwd: fixture.remote,
  });
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /origin does not contain/,
  );
});

test("release selection entrypoint writes the verification mode for each event", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/release-ref-"),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const shared = {
    MANUAL_VERIFICATION: "",
    MANUAL_REF: "v0.8.0",
    RELEASE_CREATED: "true",
    RELEASE_TAG: "v0.8.0",
    MANUAL_VIEWER_REF: "",
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
      publish_ref: "v0.8.0",
      viewer_ref: "viewer-v0.1.0",
      verification: "evidence",
    },
  );
  assert.deepEqual(
    await resolveRefOutputs(root, {
      ...shared,
      RELEASE_EVENT: "workflow_dispatch",
      MANUAL_VERIFICATION: "complete",
      MANUAL_VIEWER_REF: "viewer-v0.1.0",
    }),
    {
      publish_ref: "v0.8.0",
      viewer_ref: "viewer-v0.1.0",
      verification: "complete",
    },
  );
  await assert.rejects(
    resolveRefOutputs(root, {
      ...shared,
      RELEASE_EVENT: "workflow_dispatch",
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
  await execute(
    process.execPath,
    [path.join(import.meta.dirname, "../scripts/release/resolve-ref.mjs")],
    {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment, GITHUB_OUTPUT: output },
    },
  );
  const lines = (await fs.readFile(output, "utf8")).trim().split("\n");
  return Object.fromEntries(lines.map((line) => line.split("=", 2)));
}

test("CLI-only releases verify the earlier viewer tag and reject a moved remote tag", async (t) => {
  const fixture = await taggedFixture(t);
  await fs.writeFile(path.join(fixture.root, "core.txt"), "core-only change");
  await fixture.git("add", "core.txt");
  await fixture.git("commit", "-m", "fix: core only");
  await fixture.git("tag", "-f", "v0.8.0");
  const head = await fixture.git("rev-parse", "HEAD");
  await execute("git", ["fetch", fixture.root, "HEAD"], {
    cwd: fixture.remote,
  });
  await execute("git", ["update-ref", "refs/tags/v0.8.0", head], {
    cwd: fixture.remote,
  });
  assert.equal(await verifyReleaseRefs(fixture.root, "v0.8.0", ""), head);
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", "viewer-v0.1.0"),
    /one commit/,
  );
  await execute("git", ["update-ref", "refs/tags/viewer-v0.1.0", head], {
    cwd: fixture.remote,
  });
  await assert.rejects(
    verifyReleaseRefs(fixture.root, "v0.8.0", ""),
    /one commit/,
  );
});
