import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  packageReport,
  type PackageReport,
} from "./helpers/release_fixture.js";

interface ReleaseContextModule {
  remoteTagCommit(output: string, ref: string): string;
  resolvePublishRefs(input: {
    eventName: string;
    manualRef: string;
    manualViewerRef: string;
    releaseCreated: string;
    releaseTag: string;
    viewerReleaseCreated: string;
    viewerReleaseTag: string;
  }): { cli: string; viewer: string } | undefined;
  validateTagVersion(ref: string, version: string): void;
}

interface RegistryContractModule {
  comparePublishedPackage(
    local: PackageReport,
    remote: PackageReport,
    metadata: { gitHead?: string },
    commit: string,
  ): void;
  isMissingPackage(result: {
    code: number | null;
    stderr: string;
    stdout: string;
  }): boolean;
}

test("release selection handles ordinary pushes, releases, and manual retries", async () => {
  const context = await releaseContext();
  const shared = {
    manualViewerRef: "",
    viewerReleaseCreated: "false",
    viewerReleaseTag: "",
  };
  assert.equal(
    context.resolvePublishRefs({
      ...shared,
      eventName: "push",
      manualRef: "",
      releaseCreated: "false",
      releaseTag: "",
    }),
    undefined,
  );
  assert.deepEqual(
    context.resolvePublishRefs({
      ...shared,
      eventName: "push",
      manualRef: "",
      releaseCreated: "true",
      releaseTag: "v0.1.0",
      viewerReleaseCreated: "true",
      viewerReleaseTag: "viewer-v0.2.0",
    }),
    { cli: "v0.1.0", viewer: "viewer-v0.2.0" },
  );
  assert.deepEqual(
    context.resolvePublishRefs({
      ...shared,
      eventName: "workflow_dispatch",
      manualRef: "v1.2.3",
      manualViewerRef: "viewer-v2.3.4",
      releaseCreated: "",
      releaseTag: "",
    }),
    { cli: "v1.2.3", viewer: "viewer-v2.3.4" },
  );
  assert.throws(
    () => context.validateTagVersion("v1.2.4", "1.2.3"),
    /does not match package version/,
  );
  assert.equal(
    context.remoteTagCommit(
      `${"a".repeat(40)}\trefs/tags/v1.2.3\n${"b".repeat(40)}\trefs/tags/v1.2.3^{}\n`,
      "v1.2.3",
    ),
    "b".repeat(40),
  );
});

test("published-version guard compares bytes, inventory, and commit", async () => {
  const registry = await registryContract();
  const report = packageReport();
  registry.comparePublishedPackage(
    report,
    structuredClone(report),
    { gitHead: "c".repeat(40) },
    "c".repeat(40),
  );
  for (const name of ["mokly", "mokabook", "@other/mokly"]) {
    assert.throws(() =>
      registry.comparePublishedPackage(
        report,
        { ...report, name },
        {},
        "c".repeat(40),
      ),
    );
  }
  const mismatched = structuredClone(report);
  mismatched.integrity = `sha512-${"d".repeat(12)}`;
  assert.throws(
    () =>
      registry.comparePublishedPackage(
        report,
        mismatched,
        { gitHead: "c".repeat(40) },
        "c".repeat(40),
      ),
    /integrity differs/,
  );
  assert.equal(
    registry.isMissingPackage({
      code: 1,
      stderr: "npm error E404",
      stdout: "",
    }),
    true,
  );
  assert.equal(
    registry.isMissingPackage({ code: 1, stderr: "network reset", stdout: "" }),
    false,
  );
});

async function releaseContext(): Promise<ReleaseContextModule> {
  const url = pathToFileURL(
    path.join(repositoryRoot, "scripts/release/context.mjs"),
  ).href;
  return (await import(url)) as ReleaseContextModule;
}

async function registryContract(): Promise<RegistryContractModule> {
  const url = pathToFileURL(
    path.join(repositoryRoot, "scripts/release/registry_contract.mjs"),
  ).href;
  return (await import(url)) as RegistryContractModule;
}
