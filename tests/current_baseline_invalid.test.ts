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

import { currentBaselineFixture } from "./helpers/current_baseline_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";

for (const shape of [
  "missing root",
  "missing provenance",
  "CSS owners",
] as const) {
  for (const watch of [false, true])
    test(`invalid v8 ${shape} keeps Browse without earlier-version copy, watch=${watch}`, async (context) => {
      const fixture = await currentBaselineFixture(context, { shape });
      const messages: string[] = [];
      const running = await serve(
        fixture.config,
        { base: "HEAD", port: 0, watch },
        {
          reporter: new PlainServeReporter((line) => messages.push(line)),
        },
      );
      fixture.beforeRemove(() => running.close());
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
      assert.equal(
        (await fetch(`${running.url}/view/screens/home.html`)).status,
        200,
      );
      assert.ok(messages.length > 0);
      assert.ok(
        messages.every((line) => line.trim() !== EARLIER_BASELINE_MESSAGE),
      );
    });

  test(`invalid v8 ${shape} stops export and preserves the installed site`, async (context) => {
    const fixture = await currentBaselineFixture(context, { shape });
    await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
    const file = path.join(fixture.output, "__mokly/catalogue.json");
    const previous = await fs.readFile(file);
    const messages: string[] = [];
    await assert.rejects(
      exportCatalogue(fixture.config, {
        outDir: "site",
        base: "HEAD",
        incompatibleBaseline: () => messages.push(EARLIER_BASELINE_MESSAGE),
      }),
    );
    assert.deepEqual(await fs.readFile(file), previous);
    assert.deepEqual(messages, []);
  });

  test(`invalid v8 ${shape} stops publish before uploading`, async (context) => {
    const fixture = await currentBaselineFixture(context, { shape });
    const receiver = await startFakeReceiver(context);
    const messages: string[] = [];
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
          export: (config, options) =>
            exportCatalogue(config, {
              ...options,
              incompatibleBaseline: () =>
                messages.push(EARLIER_BASELINE_MESSAGE),
            }),
        },
      ),
    );
    assert.equal(receiver.publications.size, 0);
    assert.equal(receiver.plans.length, 0);
    assert.deepEqual(messages, []);
  });
}
