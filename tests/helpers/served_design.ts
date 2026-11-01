import assert from "node:assert/strict";
import { once } from "node:events";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";
import type { ColorScheme } from "../../packages/viewer/src/generated/catalogue/ColorScheme.js";
import type { EntryDetailV4 } from "../../packages/viewer/src/generated/catalogue/EntryDetailV4.js";
import type { Viewport } from "../../packages/viewer/src/generated/catalogue/Viewport.js";
import { spawnServe } from "../../scripts/verification/serve-process.mjs";

import { EXAMPLE_BASE, validateExampleDiagnostics } from "./example_base.js";
import type { FixtureOwner } from "./file_fixture.js";
import { repositoryRoot } from "./fixture.js";
import { shim } from "./mokly_serve.js";

export interface ServedView {
  path: string;
  kind: "screen" | "component";
  viewport: Viewport;
  colorScheme: ColorScheme;
  /** The view's file below the generated root, as relative links name it. */
  route: string;
  document: DefaultTreeAdapterMap["document"];
}

export interface ServedCatalogue {
  index: CatalogueReadModel;
  details: ReadonlyMap<string, EntryDetailV4>;
  views: readonly ServedView[];
}

export function viewRoute(
  path: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  return `${path}/index.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`;
}

async function fetchAll<T>(
  items: readonly T[],
  load: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift())
        await load(item);
    }),
  );
}

/**
 * Serve current example views with the shared unresolved base.
 * Wait for terminal Changes before returning. The owner drains the process
 * group at teardown, also when setup fails.
 */
export async function serveExample(
  owner: FixtureOwner,
  signal: AbortSignal,
): Promise<ServedCatalogue> {
  const server = await spawnServe(
    shim,
    [
      "--config",
      "examples/basic/mokly.config.json",
      "--base",
      EXAMPLE_BASE,
      "--no-watch",
      "--port",
      "0",
      "--sidecars",
      "1",
    ],
    { cwd: repositoryRoot },
  );
  let listened = false;
  let loaded = false;
  owner.after(async () => {
    const { code } = await server.stop();
    // A Serve that started must also stop cleanly on its interrupt.
    if (listened) assert.equal(code, 0, server.stderr());
    if (loaded) validateExampleDiagnostics(server.stderr());
  });
  const url = await server.listening(signal);
  listened = true;
  const catalogue = await loadCatalogue(url, signal);
  while (!server.stderr().includes("[mokly/git-failed]"))
    await once(server.child.stderr, "data", { signal });
  loaded = true;
  return catalogue;
}

/**
 * Render every screen and component view, and wait through publication
 * events until usage settles and Changes is unavailable.
 */
async function loadCatalogue(
  url: string,
  signal: AbortSignal,
): Promise<ServedCatalogue> {
  const read = async (route: string) => {
    const response = await fetch(`${url}/${route}`, { signal });
    assert.equal(response.status, 200, route);
    return response;
  };
  const events = (await read("mokly-viewer/events")).body!.getReader();
  try {
    let index = readCatalogueIndex(
      await (await read("mokly-viewer/index.json")).json(),
    );
    const views: ServedView[] = [];
    const visual = [
      ...index.screens.map((entry) => ({ kind: "screen" as const, entry })),
      ...index.components.map((entry) => ({
        kind: "component" as const,
        entry,
      })),
    ];
    const pending = visual.flatMap(({ kind, entry }) =>
      entry.views.map((view) => ({
        path: entry.path,
        kind,
        viewport: view.viewport,
        colorScheme: view.colorScheme,
        route: viewRoute(entry.path, view.viewport, view.colorScheme),
      })),
    );
    await fetchAll(pending, async (view) => {
      const html = await (
        await read(`static/mokly-generated/${view.route}`)
      ).text();
      views.push({ ...view, document: parse(html) });
    });
    for (;;) {
      index = readCatalogueIndex(
        await (await read("mokly-viewer/index.json")).json(),
      );
      if (!["pending", "preparing"].includes(index.changesStatus)) break;
      await events.read();
    }
    assert.equal(index.changesStatus, "unavailable");
    const details = new Map<string, EntryDetailV4>();
    let unsettled = visual.map(({ entry }) => entry.path);
    // Each publication can settle more usage, so recheck after every event.
    while (unsettled.length > 0) {
      await fetchAll(unsettled, async (path) => {
        const detail = readEntryDetail(
          await (await read(`mokly-viewer/entries/${path}.json`)).json(),
        );
        details.set(path, detail);
      });
      unsettled = unsettled.filter((path) =>
        details
          .get(path)!
          .views.some((view) => view.usage.status === "pending"),
      );
      if (unsettled.length > 0) await events.read();
    }
    views.sort((a, b) => a.route.localeCompare(b.route));
    return { index, details, views };
  } finally {
    await events.cancel();
  }
}
