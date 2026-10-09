import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestV10 } from "@mokly/viewer/data";

import type { ReviewAssetReader } from "../src/review/assets.js";
import { ComponentMaterialReader } from "../src/review/component_resources.js";
import { compareComponentView } from "../src/review/component_view.js";
import { catalogueLinkNormalizer } from "../src/review/moves/links.js";
import { ResourceComparison } from "../src/review/resource_comparison.js";

import { currentManifest } from "./helpers/current_manifest.js";

const html =
  '<html><head><link rel="stylesheet" href="../style.css"></head><body><a href="../target/index.html" data-mokly-link="target">Target</a></body></html>';
const manifest: ManifestV10 = currentManifest({
  schemaVersion: 10,
  generatedBy: "mokly",
  folders: [],
  sourceFiles: ["specs/target.ts"],
  entries: [
    {
      kind: "page",
      path: "target",
      title: "Target",
      description: "Target page",
      sourcePath: "specs/target.ts",
      relatedDocs: [],
    },
  ],
});
function reader(color: string): ComponentMaterialReader {
  const files = new Map([
    ["guide/index.desktop.html", html],
    ["style.css", `a[href="../target/index.html"] { color: ${color}; }`],
  ]);
  const source: ReviewAssetReader = {
    read: async (route) => {
      const text = files.get(route);
      if (text === undefined) throw new Error(`Missing ${route}`);
      return Buffer.from(text);
    },
    readIfExists: async (route) =>
      files.has(route) ? Buffer.from(files.get(route)!) : undefined,
  };
  return new ComponentMaterialReader(source);
}

for (const useFastPath of [false, true])
  test(`logical link normalization preserves real href values for CSS matching: fast=${useFastPath}`, async () => {
    const beforeReader = reader("red");
    const afterReader = reader("green");
    const changed = new Set(["mockups/style.css"]);
    const view = {
      path: "guide/index.desktop.html",
      viewport: "desktop" as const,
      colorScheme: "light" as const,
    };
    const compared = await compareComponentView(
      {
        componentAware: true,
        beforeReader,
        afterReader,
        changed,
        prefix: "mockups",
        useFastPath,
        resources: new ResourceComparison(
          beforeReader,
          afterReader,
          changed,
          "mockups",
        ),
        links: catalogueLinkNormalizer(manifest.entries, manifest.entries, []),
      },
      view,
      view,
    );
    assert.equal(compared.view.state, "changed");
    assert.equal(compared.view.reasons?.[0]?.path, "mockups/style.css");
    assert.equal(compared.view.reasons?.[0]?.analysis?.status, "matched");
    assert.equal(compared.view.excludedResources, undefined);
  });
