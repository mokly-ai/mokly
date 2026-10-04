import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { viewPage } from "../dist/server/pages.js";
import { readPreviewDescriptor } from "../packages/viewer/dist/previews/descriptor.js";
import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { RemovedEntrySnapshot } from "../packages/viewer/dist/shell/metadata.js";

import { documentText } from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";
import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

const metadata = {
  description: "Fixture",
  declaredDependencies: [],

  relatedDocs: [],
  sourcePath: "entries/fixture.mockup.tsx",
};

type RemovedEntry = RemovedEntrySnapshot["entry"];

const page: RemovedEntry = {
  ...metadata,
  kind: "page",
  path: "handbook",
  title: "Getting started",
};

const screen: RemovedEntry = {
  ...metadata,
  kind: "screen",
  path: "farewell",
  title: "Farewell",
  colorSchemes: ["light"],
  address: "example.test/farewell",
  useCasePaths: [],
};

const component: RemovedEntry = {
  ...metadata,
  kind: "component",
  path: "chip",
  title: "Chip",
  colorSchemes: ["light"],
  propSchema: { kind: "object", properties: {} },
  slots: [],
  controls: {},
  ownedDependencies: [],
};

const componentVariant: RemovedEntry = {
  ...metadata,
  kind: "component",
  path: "chip/default",
  title: "Default",
  colorSchemes: ["light"],
  variantOf: "chip",
  props: {},
  suppliedSlots: [],
  componentViews: [],
};

const flow: RemovedEntry = {
  ...metadata,
  kind: "use-case",
  path: "tour",
  title: "Tour",
  steps: [],
};

function removedShell(
  entry: RemovedEntry,
  related: readonly RemovedEntry[] = [],
): string {
  const manifest: ManifestV8 = {
    schemaVersion: 8 as const,
    folders: [],
    generatedBy: "mokly",
    sourceFiles: [],
    entries: [],
  };
  const removed: RemovedEntrySnapshot[] = [
    { folderTitles: [], entry: { ...entry } },
    ...related.map((candidate) => ({
      folderTitles: [],
      entry: { ...candidate },
      ...("variantOf" in candidate && candidate.variantOf !== undefined
        ? { parentTitle: component.title }
        : {}),
    })),
  ];
  const catalogue = createCatalogue(manifest, removed);
  return viewPage(
    entry,
    catalogue,
    publicShellContext(catalogue, {
      base: "origin/main",
      comparisons: true,
      changedEntries: [entry.path],
      updateVersion: 1,
    }),
  );
}

function descriptor(html: string) {
  const raw = /data-mokly-preview="([^"]*)"/.exec(html)?.[1];
  return readPreviewDescriptor(
    raw === undefined
      ? null
      : raw
          .replaceAll("&quot;", '"')
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&"),
  );
}

test("a removed document opens its previous version instead of an empty state", () => {
  const html = removedShell(page);
  assert.match(html, /Showing previous version/);
  assert.doesNotMatch(html, /This page was removed/);
  assert.doesNotMatch(html, /no longer in the catalogue/);
  assert.doesNotMatch(
    html,
    /data-diff-screen|data-diff-mode|data-diff-refresh/,
  );
  assert.deepEqual(descriptor(html), {
    path: "handbook",
    kind: "page",
    title: "Getting started",
  });
});

test("a removed screen opens historical frames without comparison controls", () => {
  const html = removedShell(screen);
  assert.match(html, /Showing previous version/);
  assert.doesNotMatch(html, /This screen was removed/);
  assert.doesNotMatch(html, /Select a comparison to see the previous screen/);
  assert.doesNotMatch(
    html,
    /data-diff-screen|data-diff-mode|data-diff-refresh/,
  );
  assert.doesNotMatch(html, /data-mokly-preview-template|<template/);
  assert.doesNotMatch(html, /data-workspace-frame|<iframe/);
  assert.match(html, /example\.test\/farewell/);
  assert.deepEqual(descriptor(html), {
    address: "example.test/farewell",
    path: "farewell",
    kind: "screen",
    title: "Farewell",
  });
});

test("a served stage claims no request until its client can make one", () => {
  for (const entry of [page, screen]) {
    const html = removedShell(entry);
    assert.doesNotMatch(html, /Loading previous version…/);
    assert.match(html, /Previous version unavailable/);
    assert.match(html, /The previous version could not be loaded\./);
    assert.doesNotMatch(html, /data-mokly-preview-retry|>Retry</);
  }
});

test("removed components and flows keep the behavior the contract leaves alone", () => {
  const chip = removedShell(component, [componentVariant]);
  assert.match(documentText(chip), /This component was removed/);
  assert.match(
    documentText(chip),
    /Select a comparison to see the previous version/,
  );
  assert.match(chip, /data-diff-screen/);
  assert.equal(descriptor(chip), undefined);
  const tour = removedShell(flow);
  assert.match(documentText(tour), /This user flow was removed/);
  assert.equal(descriptor(tour), undefined);
});

test("exported shells advertise only the packaged previous versions", async (t) => {
  const fixture = await createRemovedDeliveryFixture();
  t.after(() => fixture.close());
  await exportCatalogue(fixture.config, {
    base: "origin/main",
    outDir: "site",
  });
  const read = (route: string) =>
    fs.readFile(path.join(fixture.output, "view", route), "utf8");
  const document = descriptor(
    await read(
      "fixture/deleted-archive/deleted-section/removed-page/index.html",
    ),
  );
  assert.equal(document?.kind, "page");
  assert.equal(document?.published?.kind, "page");
  assert.deepEqual(document?.published, { kind: "page" });
  const removedScreen = descriptor(
    await read(
      "fixture/deleted-archive/deleted-section/removed-screen/index.html",
    ),
  );
  assert.deepEqual(removedScreen?.published, { kind: "screen" });
  const current = await read("current/index.html");
  assert.doesNotMatch(current, /data-mokly-preview=/);
  assert.doesNotMatch(current, /Showing previous version/);
});
