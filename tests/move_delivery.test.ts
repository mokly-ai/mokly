import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { exportCatalogue } from "../dist/export/run.js";
import { catalogueWithChanges } from "../dist/server/baseline_catalogue.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { removedPagePreviewSource } from "../dist/server/review_sources.js";
import { serve } from "../dist/server/serve.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";
import { assertSchemeMoveDelivery } from "./helpers/move_delivery.js";
import {
  schemeMoveCases,
  stylesheetMoveFixture,
} from "./helpers/move_review_fixture.js";

for (const scenario of schemeMoveCases)
  test(
    `${scenario.kind} delivers ${scenario.change} Dark views: moved=${scenario.moved}, CSS=${Boolean(scenario.stylesheet)}`,
    { timeout: 30_000 },
    async (t) => {
      const fixture = await stylesheetMoveFixture(
        t,
        scenario.kind,
        scenario.destination,
        scenario.stylesheet,
        scenario,
      );
      await assertSchemeMoveDelivery(t, fixture, scenario);
    },
  );

for (const kind of ["screen", "component"] as const)
  for (const destination of ["new/home", "new/deep/home"])
    for (const stylesheet of ["action.css", "old/action.css"])
      test(
        `${kind} move to ${destination} with ${stylesheet} keeps Serve and export Changes available`,
        { timeout: 30_000 },
        async (t) => {
          const fixture = await stylesheetMoveFixture(
            t,
            kind,
            destination,
            stylesheet,
          );
          const check = (catalogue: ReturnType<typeof readCatalogue>) => {
            assert.equal(catalogue.changesStatus, "ready");
            const entry = (
              kind === "screen" ? catalogue.screens : catalogue.components
            ).find((entry) => entry.path === destination)!;
            assert.equal(entry.previousPath, "old/home");
            assert.deepEqual(entry.changes, {
              status: "ready",
              included: true,
              kind: "unmodified",
            });
          };
          await t.test("Serve", async () => {
            const messages: string[] = [];
            let finish!: (status: string) => void;
            const settled = new Promise<string>((resolve) => {
              finish = resolve;
            });
            const reporter = new PlainServeReporter((line) =>
              messages.push(line),
            );
            reporter.changesReady = () => finish("ready");
            reporter.changesUnavailable = () => finish("unavailable");
            const running = await serve(
              fixture.config,
              { base: "main", port: 0, watch: false },
              { reporter },
            );
            try {
              assert.equal(await settled, "ready", messages.join(""));
              check(
                readCatalogue(
                  await (
                    await fetch(`${running.url}/__mokly/catalogue.json`)
                  ).json(),
                ),
              );
              assert.equal(
                (await fetch(`${running.url}/view/${destination}/`)).status,
                200,
              );
            } finally {
              await running.close();
            }
          });
          await t.test("export", async () => {
            await exportCatalogue(fixture.config, {
              outDir: "site",
              base: "main",
            });
            const catalogue = readCatalogue(
              JSON.parse(
                await fs.readFile(
                  path.join(fixture.root, "site/__mokly/catalogue.json"),
                  "utf8",
                ),
              ),
            );
            check(catalogue);
            assert.ok(catalogue.comparisonUrl);
            const artifacts = path.dirname(
              path.join(fixture.root, "site", catalogue.comparisonUrl),
            );
            for (const side of ["before", "after"])
              assert.equal(
                await fs.readFile(
                  path.join(artifacts, "snapshots", side, stylesheet),
                  "utf8",
                ),
                fixture.resources[stylesheet],
              );
          });
        },
      );

test("Serve and export retain all moves without old routes or removed document previews", async (t) => {
  const fixture = await movedCatalogueFixture(t);
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  const evidence = changes.componentChanges!;
  const source = removedPagePreviewSource(
    catalogueWithChanges(fixture.after.manifest, evidence),
    evidence,
    "ready",
  )!;
  assert.deepEqual(source.removedEntries, []);
  assert.equal(source.movedEntries.length, 5);
  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
    componentChanges: evidence,
    changedEntries: changes.changedEntries,
  });
  fixture.beforeRemove(() => server.close());
  const served = readCatalogue(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).json(),
  );
  assert.deepEqual(served.removedEntries, []);
  assert.equal(
    served.documents.filter((entry) => entry.previousPath).length,
    2,
  );
  const html = await (await fetch(`${server.url}/view/new/`)).text();
  assert.ok(!/<a\b[^>]*href="\/view\/old(?:\/|\?|")/.test(html));
  assert.equal(
    (await fetch(`${server.url}/static/old/screen/index.mobile.html`)).status,
    404,
  );
  await exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" });
  const exported = readCatalogue(
    JSON.parse(
      await fs.readFile(
        path.join(fixture.root, "site/__mokly/catalogue.json"),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(exported.removedEntries, []);
  for (const entries of [exported.documents, exported.pages, exported.screens])
    for (const entry of entries) {
      assert.equal(entry.previousPath, entry.path.replace(/^new/, "old"));
      assert.deepEqual(entry.changes, {
        status: "ready",
        included: true,
        kind: "unmodified",
      });
    }
  assert.ok(exported.comparisonUrl);
  const directory = path.dirname(
    path.join(fixture.root, "site", exported.comparisonUrl),
  );
  await assert.rejects(fs.stat(path.join(directory, "previews")), {
    code: "ENOENT",
  });
  assert.ok(
    (
      await fs.stat(
        path.join(directory, "snapshots/before/old/screen/index.mobile.html"),
      )
    ).isFile(),
  );
});

for (const derived of [false, true])
  for (const resourceChanged of [false, true])
    test(`moved document resources compare real bytes: derived=${derived}, edited=${resourceChanged}`, async (t) => {
      const fixture = await movedCatalogueFixture(t, {
        resource: true,
        resourceChanged,
      });
      const config = {
        ...fixture.config,
        generatedOutput: derived
          ? ("derived" as const)
          : ("committed" as const),
      };
      const evidence = await readCatalogueChanges(
        config,
        fixture.after.manifest,
        "main",
        fixture.git,
        "a".repeat(40),
        {
          outputs: fixture.after.outputs,
          routes: [...fixture.after.outputs.keys()],
          deliveredStyleSources: [],
        },
      );
      assert.equal(
        evidence.changedEntries?.includes("new/guide"),
        resourceChanged,
      );
    });

test("a moved document's equal resource does not hide another document's changed resource", async (t) => {
  const fixture = await movedCatalogueFixture(t, {
    resource: true,
    sharedResource: true,
  });
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.ok(!changes.componentChanges?.changedEntries?.includes("new/guide"));
  assert.ok(changes.componentChanges?.changedEntries?.includes("steady"));
});
