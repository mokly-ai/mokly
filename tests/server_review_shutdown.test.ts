import assert from "node:assert/strict";
import diagnosticsChannel from "node:diagnostics_channel";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import type { ServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("shutdown prevents a queued refresh from starting", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outDir = path.join(fixture.root, ".review");
  const firstStarted = deferred();
  const releaseFirst = deferred();
  let attempts = 0;
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      attempts += 1;
      if (attempts === 1) {
        firstStarted.resolve();
        await releaseFirst.promise;
      }
      await writeOwnedGeneration(outDir, attempts);
    },
    outDir,
  };
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
    review,
  });
  let closed = false;
  context.after(async () => {
    if (!closed) await server.close();
  });

  const initial = fetch(`${server.url}/__mokly/diffs/review.json`, {
    headers: { connection: "close" },
  });
  await firstStarted.promise;
  const refreshReceived = deferred();
  const channel = diagnosticsChannel.channel("http.server.request.start");
  const listener = (message: unknown): void => {
    const request = (
      message as {
        readonly request?: {
          readonly headers?: { readonly host?: string };
          readonly url?: string;
        };
      }
    ).request;
    if (
      request?.headers?.host === new URL(server.url).host &&
      request.url === "/__mokly/diffs/review.json?refresh=1"
    ) {
      refreshReceived.resolve();
    }
  };
  channel.subscribe(listener);
  context.after(() => {
    channel.unsubscribe(listener);
  });
  const refresh = fetch(`${server.url}/__mokly/diffs/review.json?refresh=1`, {
    headers: { connection: "close" },
  });
  const requestsSettled = Promise.allSettled([initial, refresh]);
  await refreshReceived.promise;

  const closing = server.close().then(() => {
    closed = true;
  });
  releaseFirst.resolve();
  await closing;
  await requestsSettled;

  assert.equal(attempts, 1);
});

async function writeOwnedGeneration(
  outDir: string,
  generation: number,
): Promise<void> {
  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(outDir, "review.json"),
    `<h1>Generation ${generation}</h1>`,
  );
  await fs.promises.writeFile(
    path.join(outDir, ".mokly-review-artifact"),
    "schemaVersion=1\n",
  );
}

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
} {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
