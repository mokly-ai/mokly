import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { prepareHosting } from "../scripts/preview/hosting.mjs";

test("preview policy uses the native CLI and isolates fork credentials", async () => {
  const workflow = parse(
    await fs.readFile(".github/workflows/preview.yml", "utf8"),
  );
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.equal(workflow.permissions["pull-requests"], undefined);
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  for (const name of ["deploy-pr", "close-pr"]) {
    assert.match(
      workflow.jobs[name].if,
      /head\.repo\.full_name == github\.repository/,
    );
  }
  assert.match(workflow.jobs["deploy-pr"].if, /release-please--/);
  for (const name of ["deploy-main", "deploy-pr"]) {
    const steps = workflow.jobs[name].steps;
    assert.equal(
      steps.find((step: { uses?: string }) => step.uses?.includes("checkout@"))
        ?.with["fetch-depth"],
      0,
    );
    assert.equal(
      steps.find((step: { uses?: string }) =>
        step.uses?.includes("setup-node@"),
      )?.with["node-version"],
      "24.21.0",
    );
    const build = steps.find(
      (step: { name: string }) => step.name === "Build Mokly preview",
    );
    assert.match(build.run, /npm run build/);
    assert.match(build.run, /bin\/mokly\.mjs build/);
    assert.match(
      build.run,
      name === "deploy-main" ? /--no-changes/ : /--base origin\/main/,
    );
    assert.match(build.run, /--out \.\.\/\.\.\/\.context\/mokly-preview/);
    assert.equal(build.env, undefined);
    for (const step of steps)
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  }
});

test("host policy writes a separate copy and preserves the built site", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-hosting-"));
  try {
    const source = path.join(root, "source");
    const output = path.join(root, "deployment");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "index.html"), "site");
    await prepareHosting(source, output);
    assert.equal(
      await fs.readFile(path.join(output, "index.html"), "utf8"),
      "site",
    );
    assert.match(
      await fs.readFile(path.join(output, "_headers"), "utf8"),
      /X-Content-Type-Options: nosniff/,
    );
    assert.deepEqual(await fs.readdir(source), ["index.html"]);
    await assert.rejects(prepareHosting(source, source), /outside/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
