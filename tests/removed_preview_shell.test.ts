import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { viewPage } from "../dist/server/pages.js";
import { readPreviewDescriptor } from "../packages/viewer/dist/previews/descriptor.js";
import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { RemovedEntrySnapshot } from "../packages/viewer/dist/shell/metadata.js";

import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

const metadata = {
  description: "Fixture",
  declaredDependencies: [],
  dependencies: [],
  navPath: [],
  relatedDocs: [],
  sourcePath: "entries/fixture.mockup.tsx",
};

type RemovedEntry = RemovedEntrySnapshot["entry"];

const page: RemovedEntry = {
  ...metadata,
  kind: "page",
  id: "handbook",
  title: "Getting started",
  route: "docs/handbook.html",
};

const screen: RemovedEntry = {
  ...metadata,
  kind: "screen",
  id: "farewell",
  title: "Farewell",
  route: "screens/farewell.html",
  address: "example.test/farewell",
  useCaseIds: [],
  viewports: ["mobile", "desktop"],
  fragments: {
    mobile: "screens/farewell.mobile.html",
    desktop: "screens/farewell.desktop.html",
  },
};

const component: RemovedEntry = {
  ...metadata,
  kind: "component",
  id: "chip",
  title: "Chip",
  route: "components/chip.html",
  viewports: ["mobile", "desktop"],
  propSchema: { kind: "object", properties: {} },
  slots: [],
  controls: {},
  ownedDependencies: [],
  variants: [
    {
      id: "default",
      title: "Default",
      props: {},
      suppliedSlots: [],
      componentViews: [],
      fragments: {
        mobile: "components/chip.default.mobile.html",
        desktop: "components/chip.default.desktop.html",
      },
    },
  ],
};

const flow: RemovedEntry = {
  ...metadata,
  kind: "use-case",
  id: "tour",
  title: "Tour",
  route: "flows/tour.html",
  steps: [],
};

function removedShell(entry: RemovedEntry): string {
  const manifest: ManifestV5 = {
    schemaVersion: 5,
    generatedBy: "mokly",
    sourceFiles: [],
    entries: [],
  };
  const removed: RemovedEntrySnapshot[] = [
    { entry, ancestors: [{ id: "example", title: "Example" }] },
  ];
  return viewPage(entry, createCatalogue(manifest, removed), {
    base: "origin/main",
    comparisons: true,
    changedRoutes: [entry.route],
    updateVersion: 1,
  });
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
    id: "handbook",
    kind: "page",
    route: "docs/handbook.html",
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
  assert.match(html, /data-mokly-preview-template="mobile"/);
  assert.match(html, /data-mokly-preview-template="desktop"/);
  assert.match(html, /example\.test\/farewell/);
  assert.deepEqual(descriptor(html), {
    address: "example.test/farewell",
    id: "farewell",
    kind: "screen",
    route: "screens/farewell.html",
    title: "Farewell",
  });
});

test("a served stage claims no request until its client can make one", () => {
  for (const entry of [page, screen]) {
    const html = removedShell(entry);
    assert.doesNotMatch(html, /Loading previous version…/);
    assert.match(html, /Previous version unavailable/);
    assert.match(html, /The previous version could not be loaded\./);
    assert.match(html, /data-mokly-preview-retry=""[^>]*>Retry</);
  }
});

test("removed components and flows keep the behavior the contract leaves alone", () => {
  const chip = removedShell(component);
  assert.match(chip, /This component was removed/);
  assert.match(chip, /Select a comparison to see the previous version/);
  assert.match(chip, /data-diff-screen/);
  assert.equal(descriptor(chip), undefined);
  const tour = removedShell(flow);
  assert.match(tour, /This user flow was removed/);
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
  const document = descriptor(await read("archive/removed.html"));
  assert.equal(document?.kind, "page");
  assert.equal(document?.published?.kind, "page");
  assert.match(
    document?.published?.kind === "page" ? document.published.path : "",
    /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/pages\/archive\/removed\.html\.json$/,
  );
  const removedScreen = descriptor(await read("screens/removed.html"));
  assert.deepEqual(removedScreen?.published, { kind: "screen" });
  const current = await read("screens/current.html");
  assert.doesNotMatch(current, /data-mokly-preview=/);
  assert.doesNotMatch(current, /Showing previous version/);
});
