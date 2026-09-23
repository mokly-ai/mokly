import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { CatalogueReadModel, CatalogueScreen } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

const BASELINE = "a".repeat(40);
const GENERATION = "b".repeat(64);
const GENERATION_ROOT = `__mokly/diffs/__generations/${GENERATION}`;
export const HISTORICAL_ROUTE = "screens/former-home.html";

/** Published test history uses the same ID as a current screen at another route. */
export async function historicalSelectionFixture() {
  const fixture = await viewerFixture();
  try {
    const source = structuredClone(fixture.catalogue);
    const home = source.screens.find(({ id }) => id === "home");
    if (!home) throw new Error("Missing current screen fixture");
    const ready = {
      status: "ready",
      kind: "unmodified",
      included: false,
    } as const;
    const historical: CatalogueScreen = {
      ...home,
      title: "Historical home",
      route: HISTORICAL_ROUTE,
      details: { ...home.details, description: "The recorded earlier screen." },
      changes: { status: "ready", kind: "removed", included: true },
      views: home.views.map((view) => ({
        ...view,
        fragmentPath: null,
        usage: { status: "unavailable" },
        comparison: { status: "ready", kind: "removed", eligible: false },
      })),
    };
    const snapshotId = createHash("sha256")
      .update(
        JSON.stringify([
          "mokly-historical-snapshot-v1",
          source.identity.id,
          "baseline",
          BASELINE,
          historical.kind,
          historical.id,
          historical.route,
        ]),
      )
      .digest("hex");
    const catalogue: CatalogueReadModel = {
      ...source,
      changesStatus: "ready",
      comparisonUrl: `${GENERATION_ROOT}/review.json`,
      collections: source.collections.map((entry) => ({
        ...entry,
        changes: ready,
      })),
      components: source.components.map((entry) => ({
        ...entry,
        changes: ready,
      })),
      pages: source.pages.map((entry) => ({ ...entry, changes: ready })),
      useCases: source.useCases.map((entry) => ({ ...entry, changes: ready })),
      screens: source.screens.map((entry) => ({
        ...entry,
        changes: ready,
        ...(entry.id === home.id ? { title: "Current home" } : {}),
      })),
      removedEntries: [
        {
          entry: historical,
          ancestors: [],
          preview: { kind: "screen" },
          snapshotId,
        },
      ],
    };
    const views = historical.views.map(({ viewport, colorScheme }) => ({
      viewport,
      colorScheme,
      state: "removed",
      ignoredIds: [],
      beforePath: `snapshots/before/screens/former-home.${viewport}.html`,
    }));
    const directory = path.join(fixture.root, GENERATION_ROOT);
    await fs.mkdir(path.join(directory, "snapshots/before/screens"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(directory, "review.json"),
      JSON.stringify({
        schemaVersion: 2,
        baseRef: "origin/main",
        baseCommit: BASELINE,
        changedPaths: [],
        sharedImpact: [],
        ignoredImpact: [],
        screens: [
          {
            id: historical.id,
            route: historical.route,
            title: historical.title,
            state: "removed",
            dependencies: [],
            sharedImpact: [],
            views,
          },
        ],
      }),
    );
    for (const { viewport } of views)
      await fs.writeFile(
        path.join(
          directory,
          `snapshots/before/screens/former-home.${viewport}.html`,
        ),
        `<!doctype html><html><body><h1>Historical ${viewport} content</h1><a href="/view/screens/home.html">Old link</a></body></html>`,
      );
    return { ...fixture, catalogue, snapshotId };
  } catch (error) {
    await fixture.close();
    throw error;
  }
}
