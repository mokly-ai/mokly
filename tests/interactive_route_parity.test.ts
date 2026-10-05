import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import { VIEWPORTS } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import {
  artifactRouteForEntry,
  portableArtifactHref,
} from "../dist/build/mock_link_routes.js";
import { loadConfig } from "../dist/config/load.js";
import { buildInteractiveRouteTable } from "../dist/interactive/route_table.js";
import { createManifest } from "../dist/registry/manifest.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test("full example Live routes match Build routes for every source view", async () => {
  const config = await loadConfig(
    repositoryRoot,
    "examples/basic/mokly.config.ts",
  );
  const graph = await loadConsumerGraph(config);
  const entries = prepareRegistry(
    graph.definitions,
    {
      ...config,
      ...graph.discovery,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
    },
    graph.documents,
  ).entries;
  const manifest = createManifest(
    entries,
    graph.sourceFiles,
    config.colorSchemes,
  );

  assertRouteParity(entries, manifest.entries, config.colorSchemes);
});

test("focused Live routes preserve fallbacks, variants, flows and pages", async (t) => {
  const fixture = await createFixture(parityFixtureSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "guide.md"),
    "# Markdown guide\n",
  );
  const config = await loadConfig(fixture.root);
  const graph = await loadConsumerGraph(config);
  const entries = prepareRegistry(
    graph.definitions,
    {
      ...config,
      ...graph.discovery,
      entryModules: graph.entrySources,
      sourceFiles: graph.sourceFiles,
    },
    graph.documents,
  ).entries;
  const manifest = createManifest(
    entries,
    graph.sourceFiles,
    config.colorSchemes,
  );

  assert.ok(
    entries.some(
      (entry) => entry.kind === "screen" && entry.variantOf === "home",
    ),
  );
  assertRouteParity(entries, manifest.entries, config.colorSchemes);
});

function assertRouteParity(
  entries: readonly ResolvedRegistryEntry[],
  manifestEntries: Parameters<typeof buildInteractiveRouteTable>[0]["entries"],
  schemes: readonly ColorScheme[],
): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const sources = entries.filter(
    (entry) => entry.kind === "screen" || entry.kind === "component",
  );
  for (const source of sources) {
    for (const viewport of VIEWPORTS) {
      for (const scheme of schemes) {
        const sourceRoute = artifactRouteForEntry(
          source,
          viewport,
          scheme,
          byPath,
          schemes,
        );
        assert.ok(
          sourceRoute,
          `${source.path} needs a ${viewport}/${scheme} view`,
        );
        const expected = authoredRouteTable(
          entries,
          sourceRoute,
          viewport,
          scheme,
          schemes,
        );
        const actual = buildInteractiveRouteTable({
          catalogueSchemes: schemes,
          colorScheme: scheme,
          entries: manifestEntries,
          sourceRoute,
          viewport,
        });
        assert.deepEqual(
          actual,
          expected,
          `${source.path} ${viewport}/${scheme}`,
        );
      }
    }
  }
}

function authoredRouteTable(
  entries: readonly ResolvedRegistryEntry[],
  sourceRoute: string,
  viewport: Viewport,
  scheme: ColorScheme,
  schemes: readonly ColorScheme[],
): Readonly<Record<string, { href: string }>> {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  return Object.fromEntries(
    [...entries]
      .sort((left, right) => left.path.localeCompare(right.path))
      .flatMap((entry) => {
        const route = artifactRouteForEntry(
          entry,
          viewport,
          scheme,
          byPath,
          schemes,
        );
        return route
          ? [[entry.path, { href: portableArtifactHref(sourceRoute, route) }]]
          : [];
      }),
  );
}

function parityFixtureSource(): string {
  return `import React from "react";
import { defineComponent, definePage, defineScreen, defineUseCase } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [] };
const card = defineComponent({ ...metadata, colorSchemes: ["light"], description: "Card", path: "card", propSchema: { kind: "object", properties: {} }, render: () => <aside>Card</aside>, title: "Card", variants: [{ slug: "default", props: {}, title: "Default" }] });
export const mockups = [
  ...defineScreen({ ...metadata, colorSchemes: ["light"], description: "Home", desktop: <main>Home</main>, path: "home", mobile: <main>Home</main>, title: "Home", useCasePaths: ["tour"], variants: [{ description: "Empty", desktop: <main>Empty</main>, slug: "empty", mobile: <main>Empty</main>, title: "Empty" }] }),
  defineScreen({ ...metadata, description: "Details", desktop: <main>Details</main>, path: "details", mobile: <main>Details</main>, title: "Details", useCasePaths: [] }),
  ...card.entries,
  defineUseCase({ ...metadata, description: "Tour", path: "tour", steps: [{ screenPath: "home" }], title: "Tour" }),
  definePage({ ...metadata, description: "Guide", path: "html-guide", render: () => "<!doctype html><html><body>Guide</body></html>", title: "Guide" })
];
`;
}
