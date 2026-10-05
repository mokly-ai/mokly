import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseReviewResult, viewRoute } from "@mokly/viewer/data";
import type { ReviewResult } from "@mokly/viewer/data";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { exportCatalogue } from "../dist/export/run.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  recordedEntrySource,
  recordedLocationsFixture,
} from "./helpers/recorded_locations.js";

for (const kind of ["screen", "component"] as const)
  for (const evidence of ["reasons", "excludedResources"] as const) {
    test(`complete Serve comparison retains case-only ${kind} side paths with ${evidence}`, async (t) => {
      const fixture = await renamedFixture(kind, evidence);
      t.after(fixture.remove);
      const { config, after, git } = await fixture.current();
      const changes = await computeCatalogueChanges(
        config,
        "main",
        git,
        after.manifest,
      );
      const server = await startCatalogueServer(config, {
        base: "main",
        port: 0,
        componentRuntime: componentRuntime(after),
        componentChanges: changes.componentChanges!,
        review: configuredServedReview(config, "main", git),
      });
      try {
        const response = await fetch(`${server.url}/__mokly/diffs/review.json`);
        assert.equal(response.status, 200, await response.clone().text());
        const result = parseReviewResult(await response.json());
        assertCaseRecord(result, kind, evidence);
        for (const [side, spelling] of [
          ["before", kind === "screen" ? "Billing" : "control/Billing"],
          ["after", kind === "screen" ? "billing" : "control/billing"],
        ] as const) {
          const snapshot = new URL(
            `snapshots/${side}/${viewRoute(spelling, "desktop", "dark")}`,
            response.url,
          );
          assert.equal((await fetch(snapshot)).status, 200);
        }
        const selected = await fetch(
          `${server.url}/__mokly/diffs/review.json?path=${kind === "screen" ? "billing" : "control/billing"}`,
        );
        assert.equal(selected.status, 200);
        assertCaseRecord(
          parseReviewResult(await selected.json()),
          kind,
          evidence,
        );
        const catalogue = await (
          await fetch(`${server.url}/__mokly/catalogue.json`)
        ).json();
        assert.ok(
          catalogue.comparisonUrl,
          "complete comparison publishes an alias",
        );
        assert.equal(
          (await fetch(new URL(catalogue.comparisonUrl, server.url))).status,
          200,
        );
      } finally {
        await server.close();
      }
    });

    test(`repository publication retains case-only ${kind} side paths with ${evidence}`, async (t) => {
      const fixture = await renamedFixture(kind, evidence);
      t.after(fixture.remove);
      const { config } = await fixture.current();
      const output = path.join(fixture.root, ".context/published");
      await buildPreview(config, output, {
        includeChanges: true,
        base: "main",
      });
      const catalogue = JSON.parse(
        await fs.readFile(path.join(output, "__mokly/catalogue.json"), "utf8"),
      );
      const result = parseReviewResult(
        JSON.parse(
          await fs.readFile(path.join(output, catalogue.comparisonUrl), "utf8"),
        ),
      );
      assertCaseRecord(result, kind, evidence);
      const directory = path.dirname(
        path.join(output, catalogue.comparisonUrl),
      );
      for (const record of records(result))
        for (const side of ["before", "after"] as const)
          for (const view of record.views)
            assert.ok(
              (
                await fs.stat(
                  path.join(
                    directory,
                    "snapshots",
                    side,
                    viewRoute(
                      record[side]!.path,
                      view.viewport,
                      view.colorScheme,
                    ),
                  ),
                )
              ).isFile(),
            );
      await exportCatalogue(config, {
        base: "main",
        outDir: ".context/exported",
      });
    });
  }

async function renamedFixture(
  kind: "screen" | "component",
  evidence: "reasons" | "excludedResources",
) {
  const fixture = await recordedLocationsFixture({
    kind,
    entryPath: kind === "screen" ? "Billing" : "control",
    variant: "Billing",
  });
  await fixture.write(
    "specs/definitions.tsx",
    recordedEntrySource(
      kind,
      kind === "screen" ? "billing" : "control",
      "billing",
    ),
  );
  await fixture.write(
    "specs/styles.css",
    evidence === "reasons"
      ? ".note { color: red; }"
      : ".note { color: blue; } .unused { color: red; }",
  );
  return fixture;
}

test("public aliases validate only the after views in the review records", async (t) => {
  const fixture = await recordedLocationsFixture({
    entryPath: "invoice",
    renderer: true,
  });
  t.after(fixture.remove);
  const configSource = await fs.readFile(
    path.join(fixture.root, "mokly.config.ts"),
    "utf8",
  );
  await fixture.write(
    "mokly.config.ts",
    configSource.replace("['light','dark']", "['light']"),
  );
  await fs.unlink(path.join(fixture.root, "specs/overview.mockup.tsx"));
  await fixture.write(
    "specs/new.mockup.tsx",
    recordedEntrySource("screen", "new"),
  );
  const { config, after, git } = await fixture.current();
  const changes = await computeCatalogueChanges(
    config,
    "main",
    git,
    after.manifest,
  );
  const server = await startCatalogueServer(config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(after),
    componentChanges: changes.componentChanges!,
    review: configuredServedReview(config, "main", git),
  });
  try {
    const response = await fetch(`${server.url}/__mokly/diffs/review.json`);
    assert.equal(response.status, 200);
    const result = parseReviewResult(await response.json());
    const invoice = result.screens.find((record) => record.path === "invoice")!;
    assert.ok(invoice.after);
    assert.ok(
      invoice.views.some(
        (view) => view.state === "removed" && view.colorScheme === "dark",
      ),
    );
    assert.equal(
      result.screens.find((record) => record.path === "overview")?.after,
      undefined,
    );
    assert.equal(
      result.screens.find((record) => record.path === "new")?.before,
      undefined,
    );
    const catalogue = await (
      await fetch(`${server.url}/__mokly/catalogue.json`)
    ).json();
    assert.ok(catalogue.comparisonUrl);
    const alias = await fetch(new URL(catalogue.comparisonUrl, server.url));
    assert.equal(alias.status, 200);
    assert.equal(
      (
        await fetch(
          new URL("snapshots/after/invoice/index.desktop.html", alias.url),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(
          new URL("snapshots/after/invoice/index.desktop.dark.html", alias.url),
        )
      ).status,
      404,
    );
  } finally {
    await server.close();
  }
});

function records(result: ReviewResult) {
  return [
    ...result.screens,
    ...result.components.flatMap((component) => component.variants),
  ];
}

function assertCaseRecord(
  result: ReviewResult,
  kind: "screen" | "component",
  evidence: "reasons" | "excludedResources",
) {
  const record = records(result)[0]!;
  assert.equal(
    record.before?.path,
    kind === "screen" ? "Billing" : "control/Billing",
  );
  assert.equal(
    record.after?.path,
    kind === "screen" ? "billing" : "control/billing",
  );
  assert.equal(record.previousPath, undefined);
  assert.ok(record.views.every((view) => view[evidence]?.length));
}
