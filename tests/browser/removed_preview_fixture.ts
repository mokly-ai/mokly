import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { build } from "esbuild";

import { readCatalogue } from "@mokly/viewer";

import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { createRemovedPreviewFixture } from "../helpers/removed_preview_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** A running catalogue holding one removed page and one removed screen. */
export interface RemovedPreviewHost {
  url: string;
  close(): Promise<void>;
}

async function waitForChanges(url: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    const model = readCatalogue(
      await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
    );
    if (model.changesStatus === "ready") return;
    await delay(50);
  }
  throw new Error("The fixture did not publish its removed entries");
}

/** Serve the fixture in development, where previews use the stable endpoint. */
export async function startServedPreviews(): Promise<RemovedPreviewHost> {
  const fixture = await createRemovedPreviewFixture();
  try {
    const running = await serve(fixture.config, {
      base: "origin/main",
      port: 0,
      watch: false,
    });
    await waitForChanges(running.url);
    return {
      url: running.url,
      close: async () => {
        await running.close();
        await fixture.close();
      },
    };
  } catch (error) {
    await fixture.close();
    throw error;
  }
}

/**
 * Export the fixture, then mount `@mokly/viewer` over the exported catalogue
 * object from a page whose origin can differ from the artifact's, so both
 * frame adapters exercise the same packaged previews.
 */
export async function startViewerPreviews(): Promise<
  RemovedPreviewHost & { frameOrigin: string }
> {
  const fixture = await createRemovedPreviewFixture();
  try {
    await exportCatalogue(fixture.config, {
      base: "origin/main",
      outDir: "site",
    });
    await build({
      bundle: true,
      entryPoints: [
        path.resolve("tests/browser/removed_preview_viewer_entry.tsx"),
      ],
      format: "esm",
      logLevel: "silent",
      outfile: path.join(fixture.output, "viewer.js"),
      platform: "browser",
      target: "es2023",
    });
    await fs.copyFile(
      "packages/viewer/dist/styles.css",
      path.join(fixture.output, "viewer.css"),
    );
    await fs.cp(
      "packages/viewer/dist/assets",
      path.join(fixture.output, "assets"),
      {
        recursive: true,
      },
    );
    const host = await serveStaticFiles(fixture.output);
    const artifact = await serveStaticFiles(fixture.output, {
      allowedOrigin: host.url,
    });
    const catalogue: unknown = JSON.parse(
      await fs.readFile(
        path.join(fixture.output, "__mokly/catalogue.json"),
        "utf8",
      ),
    );
    const data = JSON.stringify({
      catalogue,
      frameOrigin: artifact.url,
    }).replaceAll("<", "\\u003c");
    await fs.writeFile(
      path.join(fixture.output, "viewer.html"),
      `<!doctype html><link rel="stylesheet" href="/viewer.css"><body><script>window.fixture=${data}</script><script type="module" src="/viewer.js"></script></body>`,
    );
    return {
      frameOrigin: artifact.url,
      url: host.url,
      close: async () => {
        await host.close();
        await artifact.close();
        await fixture.close();
      },
    };
  } catch (error) {
    await fixture.close();
    throw error;
  }
}

/** Export the fixture and serve it as ordinary files, without any live server. */
export async function startExportedPreviews(): Promise<
  RemovedPreviewHost & { requests: readonly string[] }
> {
  const fixture = await createRemovedPreviewFixture();
  try {
    await exportCatalogue(fixture.config, {
      base: "origin/main",
      outDir: "site",
    });
    const server = await serveStaticFiles(fixture.output);
    return {
      requests: server.requests,
      url: server.url,
      close: async () => {
        await server.close();
        await fixture.close();
      },
    };
  } catch (error) {
    await fixture.close();
    throw error;
  }
}
