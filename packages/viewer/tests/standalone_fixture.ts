/** Build isolated browser inputs through the shim, then serve exact files. */
import fs from "node:fs/promises";
import path from "node:path";

import { serveHost } from "../../../tests/browser/hosts.js";
import { repositoryRoot } from "../../../tests/helpers/fixture.js";
import { serveStaticFiles } from "../../../tests/helpers/static_server.js";
import type {
  CatalogueReadModel,
  EntryDetailV1,
} from "../src/catalogue/types.js";
import { viewRoute } from "../src/data.js";

import { ownBrowserCleanup } from "./browser_cleanup.js";
import { inspectorDocument, writeBrowserFile } from "./browser_documents.js";
import {
  browserSources,
  type BrowserSourceOptions,
} from "./browser_sources.js";

export async function crossOriginFixture(options: BrowserSourceOptions = {}) {
  const workspace = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "browser-fixture-",
    ),
  );
  const root = path.join(workspace, "site");
  const cleanups: (() => Promise<void>)[] = [];
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const failures: unknown[] = [];
      for (const cleanup of [...cleanups].reverse()) {
        try {
          await cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length)
        throw new AggregateError(
          failures,
          `Browser fixture cleanup failed; retained ${workspace}`,
        );
      await fs.rm(workspace, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  try {
    await writeBrowserFile(
      workspace,
      "mokly.config.json",
      JSON.stringify({
        roots: [{ dir: "specs" }],
        colorSchemes: ["light", "dark"],
        repoRoot: ".",
      }),
    );
    await writeBrowserFile(
      workspace,
      "specs/index.mockup.tsx",
      browserSources(options),
    );
    await writeBrowserFile(
      workspace,
      "unowned.html",
      '<!doctype html><a data-mokly-link="action" href="./silent.html" id="unowned-marker">Unowned action</a>',
    );
    await writeBrowserFile(
      workspace,
      "silent.html",
      "<!doctype html><p>No inspector</p>",
    );
    await fs.symlink(
      path.join(repositoryRoot, "node_modules"),
      path.join(workspace, "node_modules"),
      "junction",
    );
    const running = await serveHost(
      [
        path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
        "serve",
        "--port",
        "0",
        "--no-watch",
        "--sidecars",
        "1",
      ],
      workspace,
    );
    cleanups.push(running.close);
    const signal = AbortSignal.timeout(180_000);
    const stream = (
      await fetch(`${running.url}/mokly-viewer/events`, { signal })
    ).body!.getReader();
    let index: CatalogueReadModel;
    const details: {
      current: Record<string, EntryDetailV1>;
      removed: Record<string, EntryDetailV1>;
    } = { current: {}, removed: {} };
    try {
      for (;;) {
        index = (await (
          await fetch(`${running.url}/mokly-viewer/index.json`, { signal })
        ).json()) as CatalogueReadModel;
        for (const entry of [...index.screens, ...index.components])
          details.current[entry.path] = (await (
            await fetch(
              `${running.url}/mokly-viewer/entries/${entry.path}.json`,
              { signal },
            )
          ).json()) as EntryDetailV1;
        if (
          Object.values(details.current).some((detail) =>
            detail.views.some((view) => view.usage.status === "unavailable"),
          )
        )
          throw new Error("Fixture render failed: " + running.diagnostics?.());
        if (
          Object.values(details.current).every(
            (detail) =>
              detail.revision === index.revision &&
              detail.views.every((view) => view.usage.status === "ready"),
          )
        )
          break;
        const event = await stream.read();
        if (event.done)
          throw new Error("Fixture Serve ended before ready details");
      }
    } finally {
      await stream.cancel();
    }
    for (const entry of [...index.screens, ...index.components]) {
      for (const view of details.current[entry.path]!.views) {
        const route = `static/mokly-generated/${viewRoute(entry.path, view.viewport, view.colorScheme)}`;
        const response = await fetch(`${running.url}/${route}`, { signal });
        if (!response.ok)
          throw new Error(`Fixture document ${route}: HTTP ${response.status}`);
        await writeBrowserFile(
          root,
          route,
          inspectorDocument(await response.text(), view.usage),
        );
      }
    }
    await running.close();
    await fs.cp(
      path.join(repositoryRoot, "packages/viewer/dist"),
      path.join(root, "mokly-viewer"),
      { recursive: true },
    );
    await fs.copyFile(
      path.join(repositoryRoot, "packages/viewer/dist/browser/inspector.js"),
      path.join(root, "mokly-viewer/client/inspector.js"),
    );
    await writeBrowserFile(
      root,
      "index.html",
      '<!doctype html><body><iframe id="frame" style="width:390px;height:300px;border:0"></iframe></body>',
    );
    await writeBrowserFile(
      root,
      "static/unowned.html",
      '<!doctype html><a data-mokly-link="action" href="./silent.html" id="unowned-marker">Unowned action</a>',
    );
    for (const name of [
      "static/silent.html",
      "static/mokly-generated/silent/index.html",
    ])
      await writeBrowserFile(root, name, "<!doctype html><p>No inspector</p>");
    const host = await serveStaticFiles(root);
    cleanups.push(host.close);
    const frames = await serveStaticFiles(root, { allowedOrigin: host.url });
    cleanups.push(frames.close);
    const view = details.current["home"]!.views.find(
      (view) => view.viewport === "mobile" && view.colorScheme === "light",
    )!;
    if (view.usage.status !== "ready")
      throw new Error("Fixture usage is not ready");
    const usage = {
      ...view.usage,
      styles: [],
      resources: [],
      viewport: view.viewport,
      colorScheme: view.colorScheme,
    };
    const temporaryPath = `/mokly-viewer/components/renders/${"a".repeat(48)}.${"b".repeat(64)}/mokly-generated/${viewRoute("home", "mobile", "light")}`;
    await writeBrowserFile(
      root,
      temporaryPath.slice(1),
      await fs.readFile(
        path.join(root, "static/mokly-generated/home/index.mobile.html"),
      ),
    );
    return { root, index, details, host, frames, usage, temporaryPath, close };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Fixture setup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}
