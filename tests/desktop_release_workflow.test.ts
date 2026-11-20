import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}
interface Job {
  if?: string;
  needs?: readonly string[];
  environment?: string;
  uses?: string;
  with?: Record<string, string>;
  secrets?: Record<string, string>;
  steps?: readonly Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, Job>;
}

const workflow = async (name: string) =>
  parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows", name),
      "utf8",
    ),
  ) as Workflow;

test("a merged desktop release pull request starts the signed release", async () => {
  const release = await workflow("release.yml");
  const check = release.jobs["desktop-tag"];
  const call = release.jobs.desktop;
  assert.ok(check && call);
  assert.match(String(check.if), /desktop_release_created == 'true'/);
  assert.match(
    String(check.steps?.at(-1)?.run),
    /commits\/refs\/tags\/\$RELEASE_TAG/,
  );
  assert.deepEqual(call.needs, ["release-please", "desktop-tag"]);
  assert.equal(call.uses, "./.github/workflows/desktop-release.yml");
  assert.equal(
    call.with?.ref,
    "${{ needs.release-please.outputs.desktop_sha }}",
  );
  assert.equal(
    call.with?.tag,
    "${{ needs.release-please.outputs.desktop_tag_name }}",
  );

  const desktop = await workflow("desktop-release.yml");
  assert.equal("push" in desktop.on, false, "a pushed tag never releases");
  const publish = desktop.jobs.release;
  assert.ok(publish);
  assert.equal(publish.environment, "desktop-release");
  assert.match(String(publish.if), /inputs\.tag != ''/);
  const steps = publish.steps ?? [];
  const checkout = steps.find((step) => step.uses?.includes("/checkout@"));
  assert.equal(checkout?.with?.ref, "${{ inputs.ref }}");
  for (const name of Object.keys(call.secrets ?? {}))
    assert.ok(
      JSON.stringify(publish).includes(`secrets.${name}`),
      `${name} is passed but never read`,
    );
  const build = steps.find((step) =>
    step.run?.includes("build --workspace @mokly-cloud/desktop"),
  );
  assert.equal(build?.env?.MKC_DESKTOP_UPDATES, "enabled");
  const preview = desktop.jobs.package?.steps ?? [];
  assert.equal(
    JSON.stringify(preview).includes("MKC_DESKTOP_UPDATES"),
    false,
    "preview packages keep the updater off",
  );
});
