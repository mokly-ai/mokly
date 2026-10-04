import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { EARLIER_BASELINE_MESSAGE } from "../dist/baseline/compatibility.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import {
  currentBaselineFixture,
  earlierBaselines,
} from "./helpers/current_baseline_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";

for (const baseline of earlierBaselines) {
  const watchModes =
    "version" in baseline && baseline.version === 7 ? [false, true] : [false];
  for (const watch of watchModes)
    test(`Serve and Build keep the catalogue usable with ${baseline.name}, watch=${watch}`, async (context) => {
      const fixture = await currentBaselineFixture(context, baseline);
      assert.deepEqual(
        (await compileCatalogue(fixture.config)).manifest,
        fixture.compilation.manifest,
      );
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
      assert.deepEqual(catalogue.removedEntries, []);
      assert.equal(
        (await fetch(`${running.url}/view/screens/home.html`)).status,
        200,
      );
      assert.equal(
        messages.filter((line) => line.trim() === EARLIER_BASELINE_MESSAGE)
          .length,
        1,
      );
    });

  test(`export succeeds without Changes for ${baseline.name}`, async (context) => {
    const fixture = await currentBaselineFixture(context, baseline);
    const messages: string[] = [];
    const result = await exportCatalogue(fixture.config, {
      outDir: "site",
      base: "HEAD",
      incompatibleBaseline: () => messages.push(EARLIER_BASELINE_MESSAGE),
    });
    const catalogue = JSON.parse(
      await fs.readFile(
        path.join(result.outDir, "__mokly/catalogue.json"),
        "utf8",
      ),
    );
    assert.equal(result.comparisonUrl, null);
    assert.equal(catalogue.changesStatus, "unavailable");
    assert.deepEqual(catalogue.removedEntries, []);
    assert.ok(
      !(await fs.readdir(path.join(result.outDir, "__mokly"))).includes(
        "diffs",
      ),
    );
    assert.deepEqual(messages, [EARLIER_BASELINE_MESSAGE]);
  });

  test(`publish succeeds with current-only output for ${baseline.name}`, async (context) => {
    const fixture = await currentBaselineFixture(context, baseline);
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
}
