import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "yaml";

import { TESTED_NODE_VERSIONS } from "../dist/cli/bootstrap.js";

import {
  assertFullHistoryCheckout,
  assertPinnedActions,
  runGuard,
  setupNodeVersion,
  workflowSource,
  type Workflow,
} from "./helpers/ci_workflow.js";

const [minimumTestedNode] = TESTED_NODE_VERSIONS;
const resultVariables = [
  "REPOSITORY_RESULT",
  "PACKAGE_RESULT",
  "UNIT_RESULT",
  "BROWSER_RESULT",
  "HYDRATION_RESULT",
  "NATIVE_RESULT",
] as const;

test("CI shards complete verification behind one prerequisite", async () => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "push"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    "browser",
    "hydration",
    "native",
    "package",
    "repository",
    "required",
    "unit",
  ]);
  const repository = workflow.jobs.repository;
  const packageJob = workflow.jobs.package;
  const unit = workflow.jobs.unit;
  const browser = workflow.jobs.browser;
  const hydration = workflow.jobs.hydration;
  const native = workflow.jobs.native;
  const required = workflow.jobs.required;
  assert.ok(repository);
  assert.ok(packageJob);
  assert.ok(unit);
  assert.ok(browser);
  assert.ok(hydration);
  assert.ok(native);
  assert.ok(required);
  for (const job of Object.values(workflow.jobs))
    assert.equal(job["timeout-minutes"], 30);
  assert.deepEqual(required.needs, [
    "repository",
    "package",
    "unit",
    "browser",
    "hydration",
    "native",
  ]);
  assert.equal(required.name, "Required CI");
  assert.equal(required.if, "always()");
  for (const job of [packageJob, unit, browser, hydration, native])
    assert.deepEqual(job.needs, ["repository"]);
  const selectedNodeMatrix =
    "${{ fromJSON(needs.repository.outputs.node-matrix) }}";
  assert.equal(packageJob.strategy?.matrix.node, selectedNodeMatrix);
  assert.equal(hydration.strategy?.matrix.node, selectedNodeMatrix);
  assert.equal(hydration.strategy?.["fail-fast"], false);
  assert.equal(hydration.strategy?.matrix.shard, undefined);
  for (const job of [unit, browser]) {
    assert.equal(job.strategy?.["fail-fast"], false);
    assert.equal(job.strategy?.matrix.node, selectedNodeMatrix);
    assert.deepEqual(job.strategy?.matrix.shard, [1, 2, 3, 4]);
  }
  assert.equal(native.strategy?.["fail-fast"], false);
  assert.deepEqual(native.strategy?.matrix.os, [
    "blacksmith-6vcpu-macos-15",
    "blacksmith-2vcpu-windows-2025",
  ]);
  assert.ok(
    repository.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite repository"),
    ),
  );
  assert.ok(
    packageJob.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite package"),
    ),
  );
  assert.ok(
    unit.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite unit --shard"),
    ),
  );
  assert.ok(
    browser.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite browser --shard"),
    ),
  );
  assert.ok(
    hydration.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite hydration"),
    ),
  );
  assert.equal(
    (source.match(/playwright install --with-deps chromium/g) ?? []).length,
    2,
  );
  assert.match(source, /include-hidden-files: true/);
  assert.match(source, /scripts\/verification\/aggregate\.mjs/);
  for (const job of [unit, browser]) {
    const upload = job.steps.find((step) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    assert.match(
      String(upload?.with?.name),
      /^verification-.+-node-\$\{\{ matrix\.node \}\}-shard-\$\{\{ matrix\.shard \}\}$/,
    );
    assert.equal(upload?.with?.overwrite, true);
  }
  const hydrationUpload = hydration.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  assert.equal(
    hydrationUpload?.with?.name,
    "verification-hydration-node-${{ matrix.node }}",
  );
  assert.equal(hydrationUpload?.with?.overwrite, true);
  const download = required.steps.find((step) =>
    step.uses?.startsWith("actions/download-artifact@"),
  );
  assert.equal(download?.with?.pattern, "verification-*");
  assert.ok(
    native.steps.some((step) =>
      step.run?.includes("tests/export_rename.test.ts"),
    ),
  );
  assert.ok(
    native.steps.some((step) =>
      step.run?.includes("tests/export_destination_races.test.ts"),
    ),
  );
  for (const job of [
    repository,
    packageJob,
    unit,
    browser,
    hydration,
    native,
  ]) {
    assertFullHistoryCheckout(job);
    const setupNode = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(setupNode?.with?.cache, "npm");
    assert.ok(job.steps.some((step) => step.run === "npm ci"));
  }
  for (const job of [packageJob, unit, browser, hydration]) {
    assert.equal(
      job.steps.some(
        (step) => step.name === "Read baseline dependency lockfile",
      ),
      false,
    );
    const setupNode = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(
      setupNode?.with?.["cache-dependency-path"],
      "package-lock.json",
    );
  }
  for (const [job, suite] of [
    [unit, "unit"],
    [browser, "browser"],
    [hydration, "hydration"],
  ] as const) {
    const installIndex = job.steps.findIndex((step) => step.run === "npm ci");
    const chromiumIndex = job.steps.findIndex((step) =>
      step.run?.includes("playwright install --with-deps chromium"),
    );
    const suiteIndex = job.steps.findIndex((step) =>
      step.run?.includes(`cargo xtask check --suite ${suite}`),
    );
    assert.ok(installIndex >= 0 && installIndex < suiteIndex);
    if (suite === "browser" || suite === "hydration")
      assert.ok(chromiumIndex >= 0 && chromiumIndex < suiteIndex);
    const commands = job.steps.map((step) => step.run ?? "").join("\n");
    assert.doesNotMatch(
      commands,
      /git merge-base HEAD origin\/main/u,
      `${suite} must not resolve its cache input from origin/main`,
    );
    assert.doesNotMatch(
      commands,
      /(?:branch-point|baseline-package-lock|git show [^\n]*package-lock\.json)/u,
      `${suite} must use the checked-out lockfile`,
    );
  }
  assert.doesNotMatch(source, /origin\/main/u);
  assert.doesNotMatch(source, /baseline-package-lock/u);
  assert.equal(setupNodeVersion(repository), 24);
  assert.equal(setupNodeVersion(native), minimumTestedNode);
  assert.equal(
    setupNodeVersion(required),
    "${{ needs.repository.outputs.node-24-version }}",
  );
  assertPinnedActions(workflow);
});

test("CI resolves the latest Node 24 patch once for every dependent job", async () => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  assert.equal(workflow.env.NODE_24_VERSION, undefined);
  const repository = workflow.jobs.repository;
  assert.ok(repository);
  const setupIndex = repository.steps.findIndex((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  const captureIndex = repository.steps.findIndex(
    (step) => step.name === "Capture exact Node.js version",
  );
  assert.ok(setupIndex >= 0 && captureIndex > setupIndex);
  const repositorySetup = repository.steps[setupIndex];
  const capture = repository.steps[captureIndex];
  assert.equal(repositorySetup?.with?.["node-version"], 24);
  assert.equal(capture?.id, "node-version");
  assert.equal(
    capture?.run,
    `echo "value=$(node --print 'process.versions.node')" >> "$GITHUB_OUTPUT"`,
  );
  assert.equal(
    repository.outputs?.["node-24-version"],
    "${{ steps.node-version.outputs.value }}",
  );
  assert.doesNotMatch(source, /steps\.node\.outputs\.node-version/);
  for (const name of ["package", "unit", "browser", "hydration", "required"]) {
    const job = workflow.jobs[name];
    assert.ok(job, name);
    assert.ok(job.needs?.includes("repository"), name);
    const setup = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(
      setup?.with?.["node-version"],
      name === "required"
        ? "${{ needs.repository.outputs.node-24-version }}"
        : "${{ matrix.node == '24' && needs.repository.outputs.node-24-version || matrix.node }}",
      `${name} must reuse the exact Node 24 version captured by the prerequisite`,
    );
  }
});

test("Required CI fails closed for every prerequisite result", async (context) => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  const required = workflow.jobs.required;
  assert.ok(required);
  const guard = required.steps.find(
    (step) => step.name === "Require every verification job",
  )?.run;
  assert.ok(guard);

  const successful = Object.fromEntries(
    resultVariables.map((variable) => [variable, "success"]),
  );
  await assert.doesNotReject(runGuard(guard, successful));

  for (const variable of resultVariables) {
    for (const result of ["failure", "skipped", "cancelled", ""]) {
      await context.test(
        `${variable} rejects ${result || "empty"}`,
        async () => {
          await assert.rejects(
            runGuard(guard, { ...successful, [variable]: result }),
          );
        },
      );
    }
  }
});
