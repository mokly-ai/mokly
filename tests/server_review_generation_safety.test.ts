import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import type { ServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("an in-flight explicit refresh queues one fresh generation", async (context) => {
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
      const generation = attempts;
      if (generation === 1) {
        firstStarted.resolve();
        await releaseFirst.promise;
      }
      await writeOwnedGeneration(outDir, generation);
    },
    outDir,
  };
  const server = await startFixtureServer(fixture.root, review);
  fixture.beforeRemove(() => server.close());

  const initial = fetch(`${server.url}/__mokly/diffs/review.json`);
  await firstStarted.promise;
  const refreshed = [
    fetch(`${server.url}/__mokly/diffs/review.json?refresh=1`),
    fetch(`${server.url}/__mokly/diffs/review.json?refresh=1`),
  ];
  releaseFirst.resolve();

  for (const response of await Promise.all(refreshed)) {
    assert.match(await response.text(), /Generation 2/);
  }
  assert.match(await (await initial).text(), /Generation 2/);
  assert.equal(attempts, 2);
});

test("an in-flight invalidation queues one fresh generation", async (context) => {
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
      const generation = attempts;
      if (generation === 1) {
        firstStarted.resolve();
        await releaseFirst.promise;
      }
      await writeOwnedGeneration(outDir, generation);
    },
    outDir,
  };
  const server = await startFixtureServer(fixture.root, review);
  fixture.beforeRemove(() => server.close());

  const initial = fetch(`${server.url}/__mokly/diffs/review.json`);
  await firstStarted.promise;
  server.publishUpdate();
  const updated = fetch(`${server.url}/__mokly/diffs/review.json`);
  releaseFirst.resolve();

  assert.match(await (await updated).text(), /Generation 2/);
  assert.match(await (await initial).text(), /Generation 2/);
  assert.equal(attempts, 2);
});

test("refresh refuses to archive an unowned output replacement", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outDir = path.join(fixture.root, ".review");
  let attempts = 0;
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      attempts += 1;
      await writeOwnedGeneration(outDir, attempts);
    },
    outDir,
  };
  const server = await startFixtureServer(fixture.root, review);
  let closed = false;
  fixture.beforeRemove(async () => {
    if (!closed) await server.close();
  });

  assert.match(
    await (await fetch(`${server.url}/__mokly/diffs/review.json`)).text(),
    /Generation 1/,
  );
  await fs.promises.rm(outDir, { recursive: true });
  await fs.promises.mkdir(outDir);
  const userFile = path.join(outDir, "keep.txt");
  await fs.promises.writeFile(userFile, "user-authored\n");

  const failed = await fetch(
    `${server.url}/__mokly/diffs/review.json?refresh=1`,
  );
  assert.equal(failed.status, 500);
  assert.match(await failed.text(), /comparison could not be loaded/);
  assert.equal(await fs.promises.readFile(userFile, "utf8"), "user-authored\n");
  assert.equal(attempts, 1);

  await server.close();
  closed = true;
  assert.equal(await fs.promises.readFile(userFile, "utf8"), "user-authored\n");
});

test("failed refresh preserves an unowned concurrent replacement", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outDir = path.join(fixture.root, ".review");
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  let attempts = 0;
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      attempts += 1;
      if (attempts === 1) {
        await writeOwnedGeneration(outDir, attempts);
        return;
      }
      refreshStarted.resolve();
      await releaseRefresh.promise;
      throw new Error("replacement interrupted");
    },
    outDir,
  };
  const server = await startFixtureServer(fixture.root, review);
  let closed = false;
  fixture.beforeRemove(async () => {
    if (!closed) await server.close();
  });

  assert.match(
    await (await fetch(`${server.url}/__mokly/diffs/review.json`)).text(),
    /Generation 1/,
  );
  const refresh = fetch(`${server.url}/__mokly/diffs/review.json?refresh=1`);
  await refreshStarted.promise;
  await fs.promises.mkdir(outDir);
  const userFile = path.join(outDir, "keep.txt");
  await fs.promises.writeFile(userFile, "user-authored\n");
  releaseRefresh.resolve();

  const failed = await refresh;
  assert.equal(failed.status, 500);
  assert.match(await failed.text(), /comparison could not be loaded/);
  assert.equal(await fs.promises.readFile(userFile, "utf8"), "user-authored\n");
  assert.equal(attempts, 2);

  await server.close();
  closed = true;
  assert.equal(await fs.promises.readFile(userFile, "utf8"), "user-authored\n");
});

test("shutdown waits for an in-flight refresh to restore output", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outDir = path.join(fixture.root, ".review");
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  let attempts = 0;
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      attempts += 1;
      if (attempts === 1) {
        await writeOwnedGeneration(outDir, attempts);
        return;
      }
      refreshStarted.resolve();
      await releaseRefresh.promise;
      throw new Error("replacement interrupted");
    },
    outDir,
  };
  const server = await startFixtureServer(fixture.root, review);
  let closed = false;
  fixture.beforeRemove(async () => {
    if (!closed) await server.close();
  });

  assert.match(
    await (await fetch(`${server.url}/__mokly/diffs/review.json`)).text(),
    /Generation 1/,
  );
  const controller = new AbortController();
  const refresh = fetch(`${server.url}/__mokly/diffs/review.json?refresh=1`, {
    signal: controller.signal,
  });
  await refreshStarted.promise;
  controller.abort();
  await assert.rejects(refresh, { name: "AbortError" });

  const closing = server.close().then(() => {
    closed = true;
  });
  const closedBeforeRelease = await Promise.race([
    closing.then(() => true),
    delay(250).then(() => false),
  ]);
  releaseRefresh.resolve();
  await closing;
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(closedBeforeRelease, false);
  assert.match(
    await fs.promises.readFile(path.join(outDir, "review.json"), "utf8"),
    /Generation 1/,
  );
  assert.equal(
    (await fs.promises.readdir(path.dirname(outDir))).some((entry) =>
      entry.startsWith(".mokly-review-served-"),
    ),
    false,
  );
});

async function startFixtureServer(root: string, review: ServedReview) {
  const config = await loadConfig(root);
  await writeCompilation(await compileCatalogue(config), config);
  return startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
    review,
  });
}

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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
