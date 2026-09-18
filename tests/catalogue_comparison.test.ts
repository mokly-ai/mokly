import assert from "node:assert/strict";
import test from "node:test";

import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { CommittedRepository } from "../dist/review/git.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { configuredServedReview } from "../dist/server/review_routes.js";

import { createExportFixture } from "./helpers/export_fixture.js";

test("Serve pins only a matching complete comparison and immutable reads never regenerate it", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const review = configuredServedReview(
    fixture.config,
    "origin/main",
    new CommittedRepository(new ConfiguredGitCommandRunner(fixture.config)),
  );
  const generate = review.generate.bind(review);
  let generations = 0;
  review.generate = async (options) => {
    generations++;
    await generate(options);
  };
  const server = await startCatalogueServer(fixture.config, {
    base: "origin/main",
    port: 0,
    review,
  });
  t.after(() => server.close());
  const read = async () =>
    (await fetch(`${server.url}/__mokly/catalogue.json`)).json();
  const initial = await read();
  assert.equal(initial.comparisonUrl, null);
  const selected = await fetch(
    `${server.url}/__mokly/diffs/review.json?route=screens/home.html`,
  );
  assert.equal(selected.status, 200);
  assert.equal(
    (await read()).comparisonUrl,
    null,
    "a selected response cannot represent all entries",
  );
  const response = await fetch(`${server.url}/__mokly/diffs/review.json`);
  assert.equal(response.status, 200);
  const bytes = await response.text();
  const pinned = await read();
  assert.match(
    pinned.comparisonUrl,
    /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/,
  );
  assert.equal(pinned.revision.content, initial.revision.content);
  assert.ok(pinned.revision.evidence > initial.revision.evidence);
  assert.equal(
    await (await fetch(`${server.url}/${pinned.comparisonUrl}`)).text(),
    bytes,
  );
  assert.equal(generations, 1);
  server.publishUpdate({
    kind: "evidence",
    changesStatus: "pending",
    version: 2,
  });
  assert.equal((await read()).comparisonUrl, null);
  assert.equal(
    await (await fetch(`${server.url}/${pinned.comparisonUrl}`)).text(),
    bytes,
  );
  const unknown = await fetch(
    `${server.url}/__mokly/diffs/__generations/${"f".repeat(64)}/review.json`,
  );
  assert.equal(unknown.status, 404);
  assert.equal(generations, 1);
});

test("a complete comparison finishing after an accepted update cannot pin stale evidence", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  const review = configuredServedReview(
    fixture.config,
    "origin/main",
    new CommittedRepository(new ConfiguredGitCommandRunner(fixture.config)),
  );
  const generate = review.generate.bind(review);
  const started = signal();
  const resume = signal();
  review.generate = async (options) => {
    await generate(options);
    started.resolve();
    await resume.promise;
  };
  const server = await startCatalogueServer(fixture.config, {
    base: "origin/main",
    port: 0,
    review,
  });
  t.after(async () => {
    resume.resolve();
    await server.close();
  });
  const response = fetch(`${server.url}/__mokly/diffs/review.json`, {
    redirect: "manual",
  });
  await started.promise;
  server.publishUpdate({ kind: "evidence", changedRoutes: [], version: 2 });
  const url = `${server.url}/__mokly/catalogue.json`;
  const accepted = await (await fetch(url)).text();
  resume.resolve();
  assert.equal((await response).status, 302);
  assert.equal(await (await fetch(url)).text(), accepted);
  assert.equal(JSON.parse(accepted).comparisonUrl, null);
});

function signal(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
