import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { serve } from "../dist/server/serve.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createExportFixture } from "./helpers/export_fixture.js";

test(
  "watched content and background evidence publish coherent catalogue revisions",
  { timeout: 30_000 },
  async (t) => {
    const source = componentEntrySource();
    const fixture = await createExportFixture(source);
    const startup = serve(fixture.config, { port: 0, watch: true });
    t.after(async () => {
      const running = await startup.catch(() => undefined);
      await running?.close();
      await fixture.close();
    });
    const running = await startup;
    const initial = await waitForCatalogue(
      running.url,
      (model) => model.changesStatus === "ready",
    );
    assert.equal(initial.comparisonUrl, null);
    const home = initial.screens.find((screen) => screen.id === "home")!;
    assert.ok(home.views.every((view) => view.usage.status === "ready"));
    const nextSource = source.replaceAll('label="Finish"', 'label="Updated"');
    await fs.writeFile(fixture.entryPath, nextSource);
    const updated = await waitForCatalogue(
      running.url,
      (model) =>
        model.changesStatus === "ready" &&
        model.revision.content > initial.revision.content,
    );
    assert.ok(updated.revision.evidence > initial.revision.evidence);
    assert.notEqual(updated.deploymentId, initial.deploymentId);
    assert.deepEqual(
      updated.screens.find((screen) => screen.id === "home")!.changes,
      {
        status: "ready",
        kind: "changed",
        included: true,
      },
    );
    assert.equal(updated.comparisonUrl, null);
    await fs.writeFile(
      fixture.entryPath,
      nextSource.replace('title: "Home"', 'title: "Updated Home"'),
    );
    const replacement = await waitForCatalogue(
      running.url,
      (model) =>
        model.changesStatus === "ready" &&
        model.screens.some((screen) => screen.title === "Updated Home") &&
        model.revision.content > updated.revision.content,
    );
    assert.equal(replacement.identity.id, initial.identity.id);
    assert.notEqual(replacement.deploymentId, updated.deploymentId);
  },
);

async function waitForCatalogue(
  origin: string,
  accepted: (model: CatalogueReadModel) => boolean,
): Promise<CatalogueReadModel> {
  const deadline = performance.now() + 20_000;
  while (performance.now() < deadline) {
    try {
      const response = await fetch(`${origin}/__mokly/catalogue.json`);
      assert.equal(response.status, 200);
      const model = readCatalogue(await response.json());
      if (accepted(model)) return model;
    } catch (error) {
      const code = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
      if (
        !code ||
        !["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(code)
      )
        throw error;
    }
    await setTimeout(30);
  }
  throw new Error("Watched catalogue did not reach the expected revision");
}
