import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface Workflow {
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, { env?: Readonly<Record<string, string>> }>>;
}

test("hosted Turbo workflows default to local cache and opt out of telemetry", async () => {
  for (const file of [
    "ci.yml",
    "preview.yml",
    "release.yml",
    "turbo-cache.yml",
  ]) {
    const workflow = parse(
      await fs.readFile(
        path.join(repositoryRoot, ".github/workflows", file),
        "utf8",
      ),
    ) as Workflow;
    assert.equal(workflow.env.TURBO_TELEMETRY_DISABLED, "1", file);
    assert.equal(workflow.env.TURBO_CACHE, "local:rw", file);
    assert.equal(
      workflow.env.TURBO_FORCE,
      file === "release.yml" ? "true" : undefined,
      file,
    );
    for (const env of [
      workflow.env,
      ...Object.values(workflow.jobs).map((job) => job.env ?? {}),
    ])
      for (const name of [
        "TURBO_TOKEN",
        "TURBO_API",
        "TURBO_TEAM",
        "TURBO_TEAMID",
        "TURBO_REMOTE_CACHE_SIGNATURE_KEY",
      ])
        assert.equal(env[name], undefined, `${file}: ${name}`);
  }
});
