import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface Job {
  if?: string;
  environment?: unknown;
  permissions?: Record<string, string>;
  needs?: readonly string[];
  steps?: readonly { env?: Record<string, string>; run?: string }[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
}

const fixture = JSON.parse(
  await fs.readFile(
    path.join(repositoryRoot, "tests/fixtures/ci/fork-pull-request.json"),
    "utf8",
  ),
);
const directory = path.join(repositoryRoot, ".github/workflows");
const workflows = await Promise.all(
  (await fs.readdir(directory))
    .filter((name) => name.endsWith(".yml"))
    .map(async (name) => ({
      name,
      workflow: parse(
        await fs.readFile(path.join(directory, name), "utf8"),
      ) as Workflow,
    })),
);

function permitted(
  job: Job,
  eventName: string,
  event: typeof fixture,
  cutover = "true",
): boolean {
  const source = (job.if ?? "true")
    .replace(/^\$\{\{\s*|\s*\}\}$/g, "")
    .replaceAll(
      "github.event.pull_request.labels.*.name",
      "github.event.pull_request.labels.map(label => label.name)",
    )
    .replace(/needs\.([\w-]+)/g, 'needs["$1"]');
  const needs = new Proxy(
    {},
    {
      get: () => ({
        result: "success",
        outputs: { action: "deploy", enabled: "true", applied: "true" },
      }),
    },
  );
  return Boolean(
    runInNewContext(source, {
      always: () => true,
      contains: (value: string, part: string) => value.includes(part),
      github: {
        event,
        event_name: eventName,
        ref:
          eventName === "pull_request"
            ? "refs/pull/37/merge"
            : "refs/heads/main",
        repository: fixture.repository.full_name,
      },
      join: (values: string[], separator: string) => values.join(separator),
      needs,
      startsWith: (value: string, prefix: string) => value.startsWith(prefix),
      vars: { MKC_CLOUD_CUTOVER_ENABLED: cutover },
    }),
  );
}

function privileged(job: Job): boolean {
  return (
    /secrets\./.test(JSON.stringify(job)) ||
    Boolean(job.environment) ||
    Object.values(job.permissions ?? {}).includes("write")
  );
}

test("fork pull request events cannot enter a secret, environment, or OIDC job", () => {
  let checked = 0;
  for (const { name, workflow } of workflows) {
    for (const eventName of ["pull_request", "pull_request_target"]) {
      if (!(eventName in workflow.on)) continue;
      assert.equal(
        Object.values(workflow.permissions).includes("write"),
        false,
        `${name} must grant writes only inside guarded jobs`,
      );
      for (const [id, job] of Object.entries(workflow.jobs)) {
        if (!privileged(job)) continue;
        checked++;
        assert.equal(
          permitted(job, eventName, fixture),
          false,
          `${name}:${id}`,
        );
      }
    }
  }
  assert.ok(checked > 0);
  const preview = workflows.find(({ name }) => name === "preview.yml")!;
  const release = preview.workflow.jobs.release!;
  const ownEvent = structuredClone(fixture);
  ownEvent.pull_request.head.repo.full_name = fixture.repository.full_name;
  assert.equal(permitted(release, "pull_request_target", ownEvent), true);
  const broken = {
    ...release,
    if: release.if!.replace(
      "github.event.pull_request.head.repo.full_name == github.repository",
      "true",
    ),
  };
  assert.equal(permitted(broken, "pull_request_target", fixture), true);
});

test("cloud delivery stays disabled until the operator enables cutover", () => {
  const event = structuredClone(fixture);
  event.pull_request.head.repo.full_name = fixture.repository.full_name;
  for (const { name, workflow } of workflows) {
    if (
      ![
        "ci.yml",
        "deploy.yml",
        "foundation.yml",
        "preview.yml",
        "site.yml",
        "desktop-release.yml",
      ].includes(name)
    )
      continue;
    for (const [id, job] of Object.entries(workflow.jobs)) {
      if (
        !privileged(job) &&
        !(name === "desktop-release.yml" && id === "package")
      )
        continue;
      for (const eventName of [
        "pull_request",
        "pull_request_target",
        "push",
        "workflow_dispatch",
      ])
        assert.equal(
          permitted(job, eventName, event, ""),
          false,
          `${name}:${id} on ${eventName}`,
        );
    }
  }
});

function requiredResult(
  job: Job,
  cutover: string,
  results: Readonly<Record<string, string>> = {},
  ref = "refs/heads/main",
) {
  assert.ok(Array.isArray(job.needs));
  const step = job.steps?.[0];
  assert.ok(step?.run);
  const needs = Object.fromEntries(
    job.needs.map((name: string) => {
      const result = results[name] ?? "skipped";
      const output = result === "success" ? "true" : "";
      return [
        name,
        {
          result,
          outputs: {
            enabled: output,
            applied: output,
            completed: output,
            deployed: output,
          },
        },
      ];
    }),
  );
  const env = Object.fromEntries(
    Object.entries(step.env ?? {}).map(([name, binding]) => {
      const expression = /^\$\{\{\s*(.*?)\s*\}\}$/u.exec(binding);
      const value: unknown = expression
        ? runInNewContext(
            expression[1]!.replace(/needs\.([\w-]+)/g, 'needs["$1"]'),
            {
              github: { ref },
              needs,
              vars: {
                MKC_CLOUD_CUTOVER_ENABLED: cutover,
                MKC_PRODUCTION_ENABLED: "false",
              },
            },
          )
        : binding;
      return [name, value === undefined ? "" : String(value)];
    }),
  );
  return spawnSync("bash", ["-euo", "pipefail", "-c", step.run], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

for (const { file, name, forbiddenRefs } of [
  { file: "deploy.yml", name: "Deployment", forbiddenRefs: [] },
  {
    file: "foundation.yml",
    name: "Foundation",
    forbiddenRefs: ["refs/heads/feature"],
  },
]) {
  test(`${name} required passes before cutover only when all jobs are skipped`, () => {
    const job = workflows.find((workflow) => workflow.name === file)?.workflow
      .jobs.required;
    assert.ok(job);
    assert.ok(Array.isArray(job.needs));
    const dependencies: readonly string[] = job.needs;
    for (const cutover of ["", "false"]) {
      const skipped = requiredResult(job, cutover);
      assert.equal(skipped.status, 0, skipped.stderr);
      assert.equal(skipped.stdout, "SKIP cloud delivery: off until cutover\n");
      for (const dependency of dependencies) {
        for (const status of ["success", "failure", "cancelled", ""]) {
          const result = requiredResult(job, cutover, { [dependency]: status });
          assert.equal(result.status, 1, `${file}: ${dependency}=${status}`);
        }
      }
      for (const ref of forbiddenRefs) {
        const result = requiredResult(job, cutover, {}, ref);
        assert.equal(result.status, 1, `${file}: ${ref}`);
        assert.match(
          result.stderr,
          /Foundation runs only from refs\/heads\/main/,
        );
      }
    }
    const successful = Object.fromEntries(
      dependencies.map((dependency: string) => [
        dependency,
        dependency.includes("production") ? "skipped" : "success",
      ]),
    );
    const enabled = requiredResult(job, "true", successful);
    assert.equal(enabled.status, 0, enabled.stderr);
  });
}
