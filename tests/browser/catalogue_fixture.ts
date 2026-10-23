import fs from "node:fs/promises";
import path from "node:path";

import type { CatalogueReadModel } from "@mokly/viewer";
import { viewRoute, documentRoute } from "@mokly/viewer/data";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { writeBrowserFile } from "../../packages/viewer/tests/browser_documents.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import { serveHost, type BrowserHost } from "./hosts.js";

/**
 * An isolated catalogue whose files and process share one cleanup boundary.
 * `watch` serves it with the file watcher, so an edit publishes.
 */
export async function serveCatalogue(
  files: Record<string, string>,
  config: Record<string, unknown> = {},
  { watch = false }: { watch?: boolean } = {},
) {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "browser-catalogue-",
    ),
  );
  let running: BrowserHost | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await running?.close();
      await fs.rm(root, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  try {
    await writeBrowserFile(
      root,
      "mokly.config.json",
      JSON.stringify({ roots: [{ dir: "specs" }], repoRoot: ".", ...config }),
    );
    for (const [name, contents] of Object.entries(files))
      await writeBrowserFile(root, name, contents);
    await fs.symlink(
      path.join(repositoryRoot, "node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
    running = await timeFixturePhase(
      "browser-catalogue",
      "serve-readiness",
      false,
      async () => {
        const host = await serveHost(
          [
            path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
            "serve",
            ...(watch ? [] : ["--no-watch"]),
            "--port",
            "0",
            "--sidecars",
            "1",
          ],
          root,
        );
        running = host;
        await verifyDocuments(host);
        return host;
      },
    );
    return { root, url: running.url, close, diagnostics: running.diagnostics };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Catalogue setup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}

/** Fixture setup reports a render error before a browser waits for absent content. */
async function verifyDocuments(host: BrowserHost): Promise<void> {
  const signal = AbortSignal.timeout(180_000);
  const index = (await (
    await fetch(`${host.url}/mokly-viewer/index.json`, { signal })
  ).json()) as CatalogueReadModel;
  const routes = [...index.screens, ...index.components].flatMap((entry) =>
    entry.views.map((view) =>
      viewRoute(entry.path, view.viewport, view.colorScheme),
    ),
  );
  routes.push(
    ...index.pages.map((entry) => documentRoute(entry.path, "light")),
    ...index.documents.flatMap((entry) =>
      entry.colorSchemes.map((scheme) => documentRoute(entry.path, scheme)),
    ),
  );
  for (const route of routes) {
    const response = await fetch(
      `${host.url}/static/mokly-generated/${route}`,
      { signal },
    );
    await response.body?.cancel();
    if (!response.ok)
      throw new Error(
        `Fixture document ${route}: HTTP ${response.status}\n${host.diagnostics?.() ?? ""}`,
      );
  }
}
