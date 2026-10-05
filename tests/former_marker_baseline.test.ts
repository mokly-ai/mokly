import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { compileCatalogue } from "../dist/build/compile.js";
import { isMoklyError } from "../dist/errors.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { formerMarkerBaselineFixture } from "./helpers/former_marker_baseline_fixture.js";

for (const watch of [false, true])
  test(`missing former-spelling baseline ranges leave Browse usable, watch=${watch}`, async (context) => {
    const fixture = await formerMarkerBaselineFixture(context);
    const current = await compileCatalogue(fixture.config);
    assert.deepEqual([...current.outputs], [...fixture.compilation.outputs]);
    const diagnostics: string[] = [];
    const running = await serve(
      fixture.config,
      { base: "HEAD", port: 0, watch },
      { reporter: new PlainServeReporter((line) => diagnostics.push(line)) },
    );
    context.after(() => running.close());
    let catalogue;
    for (let attempt = 0; attempt < 200; attempt++) {
      catalogue = await (
        await fetch(`${running.url}/__mokly/catalogue.json`)
      ).json();
      if (["unavailable", "ready"].includes(catalogue.changesStatus)) break;
      await setTimeout(25);
    }
    assert.equal(catalogue.changesStatus, "unavailable");
    assert.equal(catalogue.comparisonUrl, null);
    assert.deepEqual(catalogue.removedEntries, []);
    assert.ok(catalogue.screens.length > 0);
    const page = await fetch(`${running.url}/view/home/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Changes unavailable/i);
    assert.ok(
      diagnostics.some((line) => line.includes("missing component boundaries")),
    );
    assert.ok(
      diagnostics.every(
        (line) => !line.includes("built with an earlier version"),
      ),
    );
  });

test("export rejects invalid baseline ranges safely and retains the previous site", async (context) => {
  const fixture = await formerMarkerBaselineFixture(context);
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  const file = path.join(fixture.output, "__mokly/catalogue.json");
  const before = await fs.readFile(file);
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" }),
    (error) =>
      isMoklyError(error) &&
      error.code === "export-invalid" &&
      error.message.includes("missing component boundaries"),
  );
  assert.deepEqual(await fs.readFile(file), before);
});

test("publish rejects invalid baseline ranges safely before uploading", async (context) => {
  const fixture = await formerMarkerBaselineFixture(context);
  const receiver = await startFakeReceiver(context);
  await assert.rejects(
    publishCatalogue(
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
        export: exportCatalogue,
      },
    ),
    (error) =>
      isMoklyError(error) &&
      error.message.includes("missing component boundaries"),
  );
  assert.equal(receiver.publications.size, 0);
  assert.equal(receiver.plans.length, 0);
});
