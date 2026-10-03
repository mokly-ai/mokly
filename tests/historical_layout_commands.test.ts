import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { nestedBaselineFixture } from "./helpers/nested_baseline_fixture.js";

for (const watch of [false, true])
  test(`Serve keeps All available for an older nested baseline (watch=${watch})`, async (context) => {
    const fixture = await nestedBaselineFixture(context);
    const output: string[] = [];
    const running = await serve(
      fixture.config,
      { base: "HEAD", port: 0, watch },
      {
        reporter: new PlainServeReporter((line) => output.push(line)),
      },
    );
    context.after(() => running.close());
    let catalogue;
    for (let attempt = 0; attempt < 200; attempt++) {
      catalogue = await (
        await fetch(`${running.url}/__mokly/catalogue.json`)
      ).json();
      if (catalogue.changesStatus === "unavailable") break;
      await setTimeout(25);
    }
    assert.equal(catalogue.changesStatus, "unavailable");
    assert.equal(catalogue.comparisonUrl, null);
    assert.deepEqual(catalogue.removedEntries, []);
    assert.ok(catalogue.screens.length > 0);
    assert.equal(
      (await fetch(`${running.url}/view/screens/home.html`)).status,
      200,
    );
    assert.equal(
      output.filter((line) => line.trim() === EARLIER_BASELINE_MESSAGE).length,
      1,
    );
    assert.ok(output.every((line) => !line.includes("review-invalid")));
  });

test("export completes current-only output for an older nested baseline", async (context) => {
  const fixture = await nestedBaselineFixture(context);
  const messages: string[] = [];
  const result = await exportCatalogue(fixture.config, {
    base: "HEAD",
    outDir: "site",
    incompatibleBaseline: () => messages.push(EARLIER_BASELINE_MESSAGE),
  });
  assert.equal(result.comparisonUrl, null);
  const catalogue = JSON.parse(
    await fs.readFile(
      path.join(result.outDir, "__mokly/catalogue.json"),
      "utf8",
    ),
  );
  assert.equal(catalogue.changesStatus, "unavailable");
  assert.deepEqual(catalogue.removedEntries, []);
  assert.equal(
    (await fs.readdir(path.join(result.outDir, "__mokly"))).includes("diffs"),
    false,
  );
  assert.deepEqual(messages, [EARLIER_BASELINE_MESSAGE]);
});

test("publish uploads only current content for an older nested baseline", async (context) => {
  const fixture = await nestedBaselineFixture(context);
  const receiver = await startFakeReceiver(context);
  const messages: string[] = [];
  await publishCatalogue(
    fixture.config,
    {
      endpoint: receiver.endpoint,
      token: "fixture-token",
      repository: "github.com/example/catalogue",
      base: "HEAD",
      out: "site",
    },
    "0.13.0",
    {},
    {
      git: new NodeGitCommandRunner(fixture.root),
      fetch,
      now: () => new Date(),
      random: Math.random,
      sleep: async (milliseconds) => {
        await setTimeout(milliseconds);
      },
      export: (config, options) =>
        exportCatalogue(config, {
          ...options,
          incompatibleBaseline: () => messages.push(EARLIER_BASELINE_MESSAGE),
        }),
    },
  );
  assert.equal(receiver.publications.size, 1);
  assert.equal(receiver.plans.length, 1);
  const files = receiver.plans[0]!.files;
  const upload = JSON.parse(files.get("mokly-upload.json")!.toString("utf8"));
  assert.equal(upload.comparisonPath, null);
  assert.equal(upload.baseSha, null);
  assert.ok(
    [...files.keys()].every(
      (file) => !file.includes("/snapshots/") && !file.includes("/diffs/"),
    ),
  );
  assert.deepEqual(messages, [EARLIER_BASELINE_MESSAGE]);
});
