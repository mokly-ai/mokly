import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import type { ServedReview } from "../dist/server/configured_review.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "./helpers/fixture.js";

const endpoint = "/__mokly/diffs/review.json";

function countingReview(
  outDir: string,
): ServedReview & { generations: number; failAt: number } {
  return {
    base: "origin/main",
    outDir,
    generations: 0,
    failAt: -1,
    async generate(): Promise<void> {
      this.generations += 1;
      await fs.promises.mkdir(path.join(outDir, "snapshots/head"), {
        recursive: true,
      });
      await fs.promises.writeFile(
        path.join(outDir, "review.json"),
        JSON.stringify({ generation: this.generations }),
      );
      await fs.promises.writeFile(
        path.join(outDir, "snapshots/head/pane.html"),
        `<h1>Generation ${this.generations}</h1>`,
      );
      await fs.promises.writeFile(
        path.join(outDir, "snapshots/head/style.css"),
        `/* Generation ${this.generations} */`,
      );
      await fs.promises.writeFile(
        path.join(outDir, ".mokly-review-artifact"),
        "schemaVersion=2\n",
      );
      if (this.generations === this.failAt)
        throw new Error("private provider failure");
    },
  };
}

async function start(fixture: TestFixture, review?: ServedReview) {
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  return startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
    ...(review ? { review } : {}),
  });
}

test("comparisons generate on demand and retain immutable snapshots after refresh", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const review = countingReview(path.join(fixture.root, ".review"));
  const server = await start(fixture, review);
  fixture.beforeRemove(() => server.close());
  await fetch(`${server.url}/view/screens/home.html`);
  assert.equal(review.generations, 0);
  assert.equal((await fetch(`${server.url}/review`)).status, 404);
  const first = await fetch(`${server.url}${endpoint}`);
  assert.equal(first.status, 200);
  assert.match(first.url, /\/__generations\/[a-f0-9-]+\/review\.json$/);
  assert.match(first.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.deepEqual(await first.json(), { generation: 1 });
  const originalPane = new URL("snapshots/head/pane.html", first.url);
  const originalStyle = new URL("snapshots/head/style.css", first.url);
  assert.equal(
    await (await fetch(originalPane)).text(),
    "<h1>Generation 1</h1>",
  );
  await fetch(`${server.url}${endpoint}`);
  assert.equal(review.generations, 1);
  assert.equal(
    await (await fetch(`${originalPane.href}?refresh=1`)).text(),
    "<h1>Generation 1</h1>",
  );
  assert.equal(review.generations, 1);
  const invalid = new URL("index.html?refresh=1", first.url);
  assert.equal((await fetch(invalid)).status, 404);
  assert.equal(review.generations, 1);
  const refreshed = await fetch(`${server.url}${endpoint}?refresh=1`);
  assert.notEqual(refreshed.url, first.url);
  assert.deepEqual(await refreshed.json(), { generation: 2 });
  assert.match(await (await fetch(originalPane)).text(), /Generation 1/);
  assert.match(await (await fetch(originalStyle)).text(), /Generation 1/);
  const head = await fetch(`${server.url}${endpoint}`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const suffix of [
    "index.html",
    "../package.json",
    "%2e%2e/package.json",
    "snapshots%2fhead%2fpane.html",
  ]) {
    assert.equal((await fetch(new URL(suffix, first.url))).status, 404);
  }
});

test("watched invalidation waits for the next comparison request", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const review = countingReview(path.join(fixture.root, ".review"));
  const server = await start(fixture, review);
  fixture.beforeRemove(() => server.close());
  const initial = await fetch(`${server.url}${endpoint}`);
  server.publishUpdate();
  assert.equal(review.generations, 1);
  const results = await Promise.all([
    fetch(initial.url),
    fetch(`${server.url}${endpoint}`),
  ]);
  for (const response of results) {
    assert.deepEqual(await response.json(), { generation: 2 });
    assert.notEqual(response.url, initial.url);
  }
  assert.equal(review.generations, 2);
});

test("comparison failures return product copy and permit a retry", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const review = countingReview(path.join(fixture.root, ".review"));
  review.failAt = 1;
  const server = await start(fixture, review);
  fixture.beforeRemove(() => server.close());
  const failed = await fetch(`${server.url}${endpoint}`);
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  const body = await failed.text();
  assert.match(body, /comparison could not be loaded/);
  assert.doesNotMatch(
    (JSON.parse(body) as { error: string }).error,
    /private provider failure|<html/,
  );
  assert.match(
    (JSON.parse(body) as { details: string }).details,
    /private provider failure/,
  );
  assert.deepEqual(
    await (await fetch(`${server.url}${endpoint}?refresh=1`)).json(),
    { generation: 2 },
  );
});

test("failed refresh restores previous snapshots and shutdown removes archives", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const review = countingReview(path.join(fixture.root, ".review"));
  review.failAt = 2;
  const server = await start(fixture, review);
  let closed = false;
  fixture.beforeRemove(() => (closed ? undefined : server.close()));
  const first = await fetch(`${server.url}${endpoint}`);
  const failed = await fetch(`${server.url}${endpoint}?refresh=1`);
  assert.equal(failed.status, 500);
  assert.match(
    await (await fetch(new URL("snapshots/head/pane.html", first.url))).text(),
    /Generation 1/,
  );
  assert.deepEqual(await (await fetch(`${server.url}${endpoint}`)).json(), {
    generation: 3,
  });
  await server.close();
  closed = true;
  assert.equal(
    (await fs.promises.readdir(fixture.root)).some((entry) =>
      entry.startsWith(".mokly-review-served-"),
    ),
    false,
  );
});

test("static catalogue servers omit unavailable diff controls and Review routes", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const server = await start(fixture);
  fixture.beforeRemove(() => server.close());
  const html = await (
    await fetch(`${server.url}/view/screens/home.html`)
  ).text();
  assert.doesNotMatch(html, /data-diff-mode|href="\/review"/);
  assert.equal((await fetch(`${server.url}${endpoint}`)).status, 404);
  assert.equal((await fetch(`${server.url}/review`)).status, 404);
});
