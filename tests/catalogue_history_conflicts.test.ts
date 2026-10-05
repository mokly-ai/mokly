import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import type { CatalogueReadModel, CatalogueUsage } from "@mokly/viewer";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { exportCatalogue } from "../dist/export/run.js";
import { CommittedRepository } from "../dist/review/git.js";
import { configuredServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createExportFixture } from "./helpers/export_fixture.js";

function source(reuse = false): string {
  return `import React from "react";
import { defineComponent, definePage, defineScreen } from "@mokly/mokly";
const metadata = { relatedDocs: [], description: "Fixture" };
const action = defineComponent({ ...metadata, path: "action", title: "Action",
  propSchema: { kind: "object", properties: {} },
  render: () => <button>Continue</button>,
  variants: [{ slug:"default",  title: "Default", props: {} }] });
const holder = defineComponent({ ...metadata, path: "holder", title: "Holder",
  propSchema: { kind: "object", properties: {} }, slots: ["children"],
  render: (props) => <section>{props.children}</section>,
  variants: [{ slug:"default",  title: "Default", props: { children: <span>Saved</span> } }
    ${reuse ? "" : ', { slug:"previous", title: "Previous", props: { children: <action.Component /> } }'}] });
export const mockups = [...holder.entries, ${
    reuse
      ? `definePage({ ...metadata, path: "action", title: "Replacement",
          render: () => "<!doctype html><html><head><title>Replacement</title></head><body>Replacement</body></html>" })`
      : `...action.entries,
         defineScreen({ ...metadata, path: "home", title: "Home",
           mobile: <action.Component />, desktop: <action.Component /> }),
         defineScreen({ ...metadata, path: "empty", title: "Empty",
           mobile: <p>Empty</p>, desktop: <p>Empty</p> })`
  }];`;
}

function verify(model: CatalogueReadModel): void {
  assert.ok(!model.removedEntries.some(({ entry }) => entry.path === "action"));
  const home = model.removedEntries.find(
    ({ entry }) => entry.path === "home",
  )!.entry;
  assert.equal(home.kind, "screen");
  if (home.kind !== "screen") throw new Error("Expected screen");
  for (const view of home.views)
    assert.deepEqual(view.usage, { status: "unavailable" });
  const previous = model.removedEntries.find(
    ({ entry }) => entry.path === "holder/previous",
  )!.entry;
  assert.ok(previous.kind === "component" && "variantOf" in previous);
  if (previous.kind !== "component" || !("variantOf" in previous))
    throw new Error("Expected removed component variant");
  for (const view of previous.views)
    assert.deepEqual(view.usage, { status: "unavailable" });
  const empty = model.removedEntries.find(
    ({ entry }) => entry.path === "empty",
  )!.entry;
  assert.ok(
    empty.kind === "screen" &&
      empty.views.every((view) => view.usage.status === "ready"),
  );
  assert.deepEqual(readCatalogue(model), model);
}

for (const delivery of ["Serve", "export"] as const) {
  test(`${delivery} makes historical usage unavailable after component id reuse`, async (t) => {
    const fixture = await createExportFixture(source());
    t.after(() => fixture.close());
    const before = await exportCatalogue(fixture.config, {
      outDir: "before",
      noChanges: true,
    });
    const oldModel = readCatalogue(
      JSON.parse(
        await fs.readFile(
          path.join(before.outDir, "__mokly/catalogue.json"),
          "utf8",
        ),
      ),
    );
    const oldUsage: CatalogueUsage = oldModel.screens.find(
      (entry) => entry.path === "home",
    )!.views[0]!.usage;
    await fs.writeFile(fixture.entryPath, source(true));
    let model: CatalogueReadModel;
    let holderHtml: string;
    if (delivery === "Serve") {
      await writeCompilation(
        await compileCatalogue(fixture.config),
        fixture.config,
      );
      const review = configuredServedReview(
        fixture.config,
        "origin/main",
        new CommittedRepository(new ConfiguredGitCommandRunner(fixture.config)),
      );
      const server = await startCatalogueServer(fixture.config, {
        port: 0,
        base: "origin/main",
        review,
      });
      t.after(() => server.close());
      const response = await fetch(`${server.url}/__mokly/catalogue.json`);
      assert.equal(response.status, 200);
      model = (await response.json()) as CatalogueReadModel;
      const holder = await fetch(`${server.url}/view/holder/`);
      assert.equal(holder.status, 200);
      holderHtml = await holder.text();
    } else {
      await exportCatalogue(fixture.config, { outDir: "site" });
      model = JSON.parse(
        await fs.readFile(
          path.join(fixture.output, "__mokly/catalogue.json"),
          "utf8",
        ),
      ) as CatalogueReadModel;
      holderHtml = await fs.readFile(
        path.join(fixture.output, "view/holder/index.html"),
        "utf8",
      );
    }
    verify(model);
    assert.doesNotMatch(holderHtml, /Changed component:/);
    const broken = structuredClone(model);
    const home = broken.removedEntries.find(
      ({ entry }) => entry.path === "home",
    )!.entry;
    if (home.kind !== "screen") throw new Error("Expected screen");
    home.views[0]!.usage = oldUsage;
    assert.throws(() => readCatalogue(broken), /unknown component/);
  });
}
