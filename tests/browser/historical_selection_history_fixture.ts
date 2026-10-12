import fs from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";

import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

export const HISTORY_ENTRIES = [
  {
    previousPath: "history-screen-old",
    currentPath: "history-screen",
    kind: "screen",
    previousRoute: "history-screen-old/index.html",
    currentRoute: "history-screen/index.html",
    previousTitle: "Previous screen",
    currentTitle: "Current screen",
  },
  {
    previousPath: "history-page-old",
    currentPath: "history-page",
    kind: "page",
    previousRoute: "history-page-old/index.html",
    currentRoute: "history-page/index.html",
    previousTitle: "Previous page",
    currentTitle: "Current page",
  },
] as const;

function historySource(current: boolean): string {
  const version = current ? "Current" : "Previous";
  const suffix = current ? "" : "-old";
  return `import React from "react";
import { definePage, defineScreen } from "@mokly/mokly";
const metadata = { description: "History fixture", relatedDocs: [] };
export const mockups = [
  defineScreen({ ...metadata, path: "history-screen${suffix}", title: "${version} screen", useCasePaths: [],
    mobile: <main><h1>${version} mobile screen</h1></main>,
    desktop: <main><h1>${version} desktop screen</h1></main> }),
  definePage({ ...metadata, path: "history-page${suffix}", title: "${version} page",
    render: () => '<!doctype html><html><body><h1>${version} page content</h1></body></html>' }),
];`;
}

/** A real Git baseline with a screen and page replaced under new paths. */
export async function startHistoricalSelectionHistory(
  mode: "serve" | "static",
) {
  const fixture = await createExportFixture(historySource(false));
  let closeHost: (() => Promise<void>) | undefined;
  try {
    const baseCommit = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
    await fs.writeFile(fixture.entryPath, historySource(true));
    const host =
      mode === "serve"
        ? await serve(fixture.config, {
            base: "origin/main",
            port: 0,
            watch: false,
          })
        : await (async () => {
            await exportCatalogue(fixture.config, { outDir: "site" });
            return serveStaticFiles(fixture.output);
          })();
    closeHost = () => host.close();
    for (let attempt = 0; attempt < 600; attempt++) {
      const catalogue = readCatalogue(
        await (await fetch(`${host.url}/mokly-viewer/catalogue.json`)).json(),
      );
      if (catalogue.changesStatus === "ready")
        return {
          baseCommit,
          catalogue,
          url: host.url,
          close: async () => {
            await host.close();
            await fixture.close();
          },
        };
      await delay(50);
    }
    throw new Error("The fixture did not publish its historical records");
  } catch (error) {
    await closeHost?.();
    await fixture.close();
    throw error;
  }
}
