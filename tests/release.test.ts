import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  packageReport,
  type PackageReport,
} from "./helpers/release_fixture.js";

interface WorkflowStep {
  env?: Readonly<Record<string, string>>;
  id?: string;
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  env?: Readonly<Record<string, string>>;
  environment?: string;
  if?: string;
  name?: string;
  needs?: readonly string[];
  outputs?: Readonly<Record<string, string>>;
  permissions?: Readonly<Record<string, string>>;
  steps: readonly WorkflowStep[];
  strategy?: {
    "fail-fast"?: boolean;
    matrix: Readonly<Record<string, readonly (string | number)[]>>;
  };
}

interface Workflow {
  concurrency: { "cancel-in-progress": boolean };
  jobs: Readonly<Record<string, WorkflowJob>>;
  on: Readonly<Record<string, unknown>>;
  permissions: Readonly<Record<string, string>>;
}

interface WorkflowDispatch {
  inputs: Readonly<
    Record<
      string,
      {
        default?: string;
        options?: readonly string[];
        required?: boolean;
        type?: string;
      }
    >
  >;
}

interface ReleaseContextModule {
  remoteTagCommit(output: string, ref: string): string;
  resolvePublishRef(input: {
    eventName: string;
    manualRef: string;
    releaseCreated: string;
    releaseTag: string;
  }): string | undefined;
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

test("release workflow selects only releases and isolates OIDC publish", async () => {
  const source = await workflowSource("release.yml");
  const workflow = parse(source) as Workflow;
  const publish = workflow.jobs.publish;
  const selection = workflow.jobs["select-release"];
  assert.ok(publish);
  assert.ok(selection);
  const dispatch = workflow.on.workflow_dispatch as WorkflowDispatch;
  assert.deepEqual(dispatch.inputs.verification, {
    description: "Reuse exact-tree CI evidence or run complete verification",
    required: true,
    type: "choice",
    options: ["evidence", "complete"],
    default: "evidence",
  });
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(publish.environment, "npm");
  assert.deepEqual(publish.permissions, {
    actions: "read",
    contents: "read",
    "id-token": "write",
  });
  assert.equal(
    selection.outputs?.verification,
    "${{ steps.select.outputs.verification }}",
  );
  assert.equal(
    publish.env?.RELEASE_VERIFICATION,
    "${{ needs.select-release.outputs.verification }}",
  );
  assert.equal(source.includes("NPM_TOKEN"), false);
  assert.equal(source.includes("NODE_AUTH_TOKEN"), false);
  assert.match(source, /package-manager-cache: false/);
  assert.match(source, /npm publish "\$ARCHIVE_PATH" --access public/);
  assert.match(source, /--mode guard/);
  assert.match(source, /--mode verify/);
  assert.match(source, /release-please-action@[a-f0-9]{40}/);
  assert.match(source, /outputs\['packages\/viewer--release_created'\]/);
  assert.match(source, /outputs\['packages\/viewer--tag_name'\]/);
  const names = publish.steps.map((step) => step.name);
  const gateOrder = [
    "Verify immutable tags",
    "Install dependencies",
    "Audit workspace dependencies",
    "Select verification evidence",
    "Set up Rust",
    "Install Chromium",
    "Run complete verification",
    "Prepare exact publish artifacts",
  ];
  for (const [index, name] of gateOrder.entries()) {
    assert.ok(names.includes(name), name);
    if (index > 0)
      assert.ok(
        names.indexOf(gateOrder[index - 1]) < names.indexOf(name),
        name,
      );
  }
  const fallbackCondition = "steps.evidence.outputs.mode != 'evidence'";
  for (const name of [
    "Set up Rust",
    "Install Chromium",
    "Run complete verification",
  ])
    assert.equal(
      publish.steps.find((step) => step.name === name)?.if,
      fallbackCondition,
    );
  const evidence = publish.steps.find(
    (step) => step.name === "Select verification evidence",
  );
  assert.equal(evidence?.id, "evidence");
  assert.deepEqual(evidence?.env, { GITHUB_TOKEN: "${{ github.token }}" });
  assert.deepEqual(
    publish.steps
      .filter((step) => step.env?.GITHUB_TOKEN)
      .map((step) => step.name),
    ["Select verification evidence"],
  );
  const preserve = publish.steps.find(
    (step) => step.name === "Preserve checked artifacts",
  );
  assert.match(
    String(preserve?.with?.path),
    /\.context\/release-evidence\/record\.json/,
  );
  assert.ok(
    names.indexOf("Guard existing viewer version") <
      names.indexOf("Publish viewer with npm trusted publishing"),
  );
  const ordered = [
    "Prepare exact publish artifacts",
    "Smoke-test exact publish artifacts",
    "Recheck immutable tags and source",
    "Preserve checked artifacts",
    "Guard existing viewer version",
    "Publish viewer with npm trusted publishing",
    "Verify viewer registry package and provenance",
    "Guard existing CLI version",
    "Publish CLI with npm trusted publishing",
    "Verify CLI registry package and provenance",
  ];
  for (const [index, name] of ordered.entries()) {
    assert.ok(names.includes(name), name);
    if (index > 0)
      assert.ok(names.indexOf(ordered[index - 1]) < names.indexOf(name), name);
  }
  assert.match(source, /group: npm-release/);
  assert.match(source, /verify-ref\.mjs "\$CLI_REF" "\$VIEWER_REF"/);
  assert.match(source, /--artifacts .context\/release-artifact/);
  assertPinnedActions(workflow);
});

test("release selection handles ordinary pushes, releases, and manual retries", async () => {
  const context = await releaseContext();
  assert.equal(
    context.resolvePublishRef({
      eventName: "push",
      manualRef: "",
      releaseCreated: "false",
      releaseTag: "",
    }),
    undefined,
  );
  assert.equal(
    context.resolvePublishRef({
      eventName: "push",
      manualRef: "",
      releaseCreated: "true",
      releaseTag: "v0.1.0",
    }),
    "v0.1.0",
  );
  assert.equal(
    context.resolvePublishRef({
      eventName: "workflow_dispatch",
      manualRef: "v1.2.3",
      releaseCreated: "",
      releaseTag: "",
    }),
    "v1.2.3",
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

async function workflowSource(name: string): Promise<string> {
  return await fs.promises.readFile(
    path.join(repositoryRoot, ".github", "workflows", name),
    "utf8",
  );
}

function assertPinnedActions(workflow: Workflow): void {
  const actions = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.uses ? [step.uses] : [])),
  );
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /@[a-f0-9]{40}$/);
}

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
