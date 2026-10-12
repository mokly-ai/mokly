import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { currentManifest } from "../../../tests/helpers/current_manifest.js";
import { readCatalogue } from "../src/catalogue/reader.js";
import type { ManifestEntry, ManifestV10 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

const screen = (path: string) =>
  ({
    colorSchemes: ["light"],
    description: path,
    kind: "screen",
    path,
    relatedDocs: [],
    sourcePath: `specs/${path}.mockup.tsx`,
    tags: [],
    title: path,
    useCasePaths: [],
  }) as unknown as ManifestEntry;

const manifest: ManifestV10 = currentManifest({
  entries: [screen("account/billing/invoice"), screen("home")],
  folders: [],
  generatedBy: "mokly",
  schemaVersion: 10,
  sourceFiles: [],
});

test("a catalogue keeps the previous path of each current entry a move paired", () => {
  const catalogue = createCatalogue(
    manifest,
    [],
    [
      { path: "account/billing/invoice", previousPath: "billing/invoice" },
      { path: "gone", previousPath: "old/gone" },
    ],
  );
  assert.deepEqual(
    [...catalogue.previousPaths],
    [["account/billing/invoice", "billing/invoice"]],
  );
  assert.equal(createCatalogue(manifest).previousPaths.size, 0);
});

test("the public viewer reads each paired entry's previous path from the read model", () => {
  const model = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v6.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const details = model.screens.find(
    (entry: { path: string }) => entry.path === "product/browse/details",
  );
  details.previousPath = "product/details";
  const catalogue = viewerCatalogue(readCatalogue(model));
  assert.deepEqual(
    [...catalogue.previousPaths],
    [["product/browse/details", "product/details"]],
  );
});
