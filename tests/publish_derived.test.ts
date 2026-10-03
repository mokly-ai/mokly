import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import type { UploadManifest } from "../dist/publish/types.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { directoryFiles } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { validEntrySource } from "./helpers/fixture.js";

test("publish bundles rebuilt derived comparisons and can replace them with current-only output", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Published derived screen" }),
  );
  const receiver = await startFakeReceiver(context, { token: "fixture-token" });
  const dependencies = {
    git: new NodeGitCommandRunner(fixture.root),
    export: exportCatalogue,
    now: () => new Date(),
    random: () => 0,
    sleep: async () => undefined,
    fetch,
  };
  const options = {
    out: "site",
    endpoint: receiver.endpoint,
    token: "fixture-token",
    repository: "github.com/sample/catalogue",
  };
  await publishCatalogue(fixture.config, options, "1.2.3", {}, dependencies);
  const output = path.join(fixture.root, "site");
  const manifestPath = path.join(output, "mokly-upload.json");
  const manifest = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as UploadManifest;
  assert.equal(manifest.baseSha, fixture.commit);
  assert.equal(manifest.headSha, fixture.commit);
  assert.ok(manifest.comparisonPath);
  const reviewPath = path.join(output, manifest.comparisonPath);
  const review = JSON.parse(await fs.readFile(reviewPath, "utf8"));
  assert.equal(review.baseCommit, fixture.commit);
  assert.equal(review.baseRef, manifest.baseRef);
  assert.match(
    await fs.readFile(
      path.join(
        path.dirname(reviewPath),
        "snapshots/after/screens/home.mobile.html",
      ),
      "utf8",
    ),
    /Published derived screen/,
  );
  assert.doesNotMatch(
    await fs.readFile(
      path.join(
        path.dirname(reviewPath),
        "snapshots/before/screens/home.mobile.html",
      ),
      "utf8",
    ),
    /Published derived screen/,
  );
  assert.equal(receiver.plans.length, 1);
  await assertExchangeMatchesOutput(
    receiver.plans[0]!.files,
    receiver.blobs,
    output,
    receiver.plans[0]!.ownership.files,
  );
  await fixture.git("update-ref", "-d", "refs/remotes/origin/main");
  receiver.publications.clear();
  await publishCatalogue(
    fixture.config,
    { ...options, noChanges: true },
    "1.2.3",
    {},
    dependencies,
  );
  const current = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as UploadManifest;
  assert.equal(current.baseSha, null);
  assert.equal(current.baseRef, null);
  assert.equal(current.comparisonPath, null);
  assert.equal(receiver.plans.length, 2);
  assert.equal(
    [...receiver.plans[1]!.files.keys()].some((name) =>
      name.startsWith("__mokly/diffs/"),
    ),
    false,
  );
  await assertExchangeMatchesOutput(
    receiver.plans[1]!.files,
    receiver.blobs,
    output,
    receiver.plans[1]!.ownership.files,
  );
});

async function assertExchangeMatchesOutput(
  plan: ReadonlyMap<string, Buffer>,
  blobs: ReadonlyMap<string, Buffer>,
  output: string,
  ownership: readonly { path: string; sha256: string; size: number }[],
): Promise<void> {
  const outputFiles = await directoryFiles(output);
  for (const entry of ownership)
    assert.deepEqual(
      plan.get(entry.path) ?? blobs.get(entry.sha256),
      outputFiles.get(entry.path),
      entry.path,
    );
  assert.deepEqual(
    plan.get(".mokly-export-artifact"),
    outputFiles.get(".mokly-export-artifact"),
  );
}
