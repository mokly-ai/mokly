import { readCatalogue } from "@mokly/viewer";

import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { createRemovedPreviewFixture } from "../helpers/removed_preview_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";
import { waitUntil } from "../helpers/wait_until.js";

import { hostExportedViewer } from "./viewer_host.js";

/** A running catalogue holding one removed page and one removed screen. */
export interface RemovedPreviewHost {
  url: string;
  close(): Promise<void>;
}

async function waitForChanges(url: string): Promise<void> {
  await waitUntil(
    async () => {
      const model = readCatalogue(
        await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
      );
      return model.changesStatus === "ready";
    },
    {
      timeoutMs: 30_000,
      intervalMs: 50,
      message: "The fixture did not publish its removed entries",
    },
  );
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
  RemovedPreviewHost & { cspUrl: string; frameOrigin: string }
> {
  const fixture = await createRemovedPreviewFixture();
  try {
    await exportCatalogue(fixture.config, {
      base: "origin/main",
      outDir: "site",
    });
    const viewer = await hostExportedViewer(fixture.output);
    return {
      ...viewer,
      close: async () => {
        await viewer.close();
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
