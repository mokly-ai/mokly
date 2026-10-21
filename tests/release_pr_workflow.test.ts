import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return Object.fromEntries(Object.entries(value));
}

test("trusted release PR source checks block the required CI dependency", async () => {
  const value: unknown = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ),
  );
  const jobs = record(record(value).jobs);
  const repository = record(jobs.repository);
  assert.ok(Array.isArray(repository.steps));
  const steps = repository.steps.map((step: unknown) => record(step));
  const check = steps.find((step) =>
    String(step.run).includes("scripts/release/check-pr.mjs"),
  );
  assert.ok(
    check,
    "the Repository job must reject unsafe release PRs before tags exist",
  );
  assert.equal(
    check.if,
    "steps.profile.outputs.release-pull-request == 'true'",
  );
  assert.equal(
    record(check.env).RELEASE_BASE_SHA,
    "${{ github.event.pull_request.base.sha }}",
  );
  assert.match(String(check.run), /"\$RELEASE_BASE_SHA"/);
  const profile = steps.find((step) => step.id === "profile");
  assert.ok(profile);
  assert.match(
    String(record(profile.env).RELEASE_PULL_REQUEST),
    /head\.repo\.full_name == github\.repository/,
  );
  assert.match(
    String(profile.run),
    /release-pull-request=\$RELEASE_PULL_REQUEST/,
  );
  const verification = steps.findIndex(
    (step) => step.name === "Run repository verification",
  );
  assert.ok(steps.indexOf(check) < verification);
  const required = record(jobs.required).needs;
  assert.ok(Array.isArray(required));
  assert.ok(required.includes("repository"));
});
