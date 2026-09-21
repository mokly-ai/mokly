import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { exportCatalogue } from "../dist/export/run.js";
import { CommittedRepository } from "../dist/review/git.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

function pageSource(route = "handbook.html"): string {
  return `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "handbook", title: "Handbook", description: "Catalogue guidance", dependencies: [], relatedDocs: [], route: ${JSON.stringify(route)}, render: () => '<!doctype html><html><body><h1>Handbook</h1></body></html>' }));`;
}

test("hydrated Serve and export render a removed route", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, validEntrySource());
  const server = await startReviewedServer(fixture);
  context.after(() => server.close());

  const served = await fetch(`${server.url}/view/handbook.html`);
  assert.equal(served.status, 200);
  assert.match(await served.text(), /Showing previous version/);

  await exportCatalogue(fixture.config, { outDir: "site" });
  const exported = await fs.readFile(
    path.join(fixture.output, "view/handbook.html"),
    "utf8",
  );
  assert.match(exported, /data-mokly-react-shell=""/);
  assert.match(exported, /Showing previous version/);
});

test("hydrated Serve and export distinguish renamed routes", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, pageSource("guides/handbook.html"));
  const server = await startReviewedServer(fixture);
  context.after(() => server.close());

  const oldRoute = await fetch(`${server.url}/view/handbook.html`);
  assert.equal(oldRoute.status, 200);
  assert.match(await oldRoute.text(), /Showing previous version/);
  const currentRoute = await fetch(`${server.url}/view/guides/handbook.html`);
  assert.equal(currentRoute.status, 200);
  assert.doesNotMatch(await currentRoute.text(), /Showing previous version/);

  await exportCatalogue(fixture.config, { outDir: "site" });
  const read = (name: string) =>
    fs.readFile(path.join(fixture.output, name), "utf8");
  assert.match(await read("view/handbook.html"), /Showing previous version/);
  const current = await read("view/guides/handbook.html");
  assert.match(current, /data-mokly-react-shell=""/);
  assert.doesNotMatch(current, /Showing previous version/);
});

async function startReviewedServer(
  fixture: Awaited<ReturnType<typeof createExportFixture>>,
) {
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  const review = configuredServedReview(
    fixture.config,
    "origin/main",
    new CommittedRepository(new ConfiguredGitCommandRunner(fixture.config)),
  );
  return startCatalogueServer(fixture.config, {
    base: "origin/main",
    port: 0,
    review,
  });
}
