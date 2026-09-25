import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../dist/review/selection_types.js";
import type { SelectedReviewRoutesOptions } from "../dist/server/selected_review_capture.js";
import { SelectedReviewRoutes } from "../dist/server/selected_review_routes.js";
import type { RemovedPagePreviewArtifact } from "../packages/viewer/dist/review/page_preview.js";
import type { ReviewArtifact } from "../packages/viewer/dist/review/types.js";

const page = {
  description: "Removed page",
  id: "removed-page",
  kind: "page" as const,
  navPath: [],
  relatedDocs: [],
  route: "archive/removed.html",
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};
const baseline = {
  entries: [page],
  generatedBy: "mokly" as const,
  schemaVersion: 6 as const,
  sourceFiles: [],
};
const pageSource: RemovedPagePreviewSource = {
  baseline,
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedRoutes: [page.route],
  removedEntries: [{ entry: page, ancestors: [] }],
  schemaVersion: 1,
};
const reviewSource: SelectedReviewSource = {
  after: { ...baseline, entries: [] },
  before: baseline,
  baseCommit: pageSource.baseCommit,
  baseRef: pageSource.baseRef,
  changedPaths: [],
  headDigests: {},
};

function pageArtifact(
  source = pageSource,
  route = page.route,
): RemovedPagePreviewArtifact {
  return {
    files: new Map([
      [
        `snapshots/before/${route}`,
        Buffer.from(`<main>${source.baseCommit}</main>`),
      ],
    ]),
    preview: {
      schemaVersion: 1,
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      route,
      documentPath: `snapshots/before/${route}`,
    },
  };
}

function reviewArtifact(): ReviewArtifact {
  return {
    files: new Map([
      ["snapshots/before/screens/removed.mobile.html", "before screen"],
    ]),
    result: {
      baseCommit: reviewSource.baseCommit,
      baseRef: reviewSource.baseRef,
      changedPaths: [],
      ignoredImpact: [],
      schemaVersion: 4,
      screens: [],
    },
  };
}

async function start(
  t: test.TestContext,
  pageProvider: RemovedPagePreviewProvider,
  options: Partial<SelectedReviewRoutesOptions> = {},
) {
  const comparison: SelectedReviewProvider = {
    generate: async () => reviewArtifact(),
  };
  const routes = new SelectedReviewRoutes({
    base: "main",
    comparison: { provider: comparison, source: () => reviewSource },
    page: { provider: pageProvider, source: () => pageSource },
    ...options,
  });
  const server = createServer((request, response) => {
    void routes.handle(
      new URL(request.url!, "http://localhost"),
      response,
      request.method ?? "GET",
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await routes.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  return { origin, routes };
}

test("page selections share immutable capture, refresh, and HTTP protections", async (t) => {
  let calls = 0;
  const server = await start(t, {
    async generate(source, selection) {
      calls++;
      assert.equal(selection.kind, "page");
      assert.equal(selection.route, page.route);
      return pageArtifact(source);
    },
  });
  const stable = `${server.origin}/__mokly/diffs/review.json?page=${encodeURIComponent(page.route)}`;
  const [first, coalesced] = await Promise.all([fetch(stable), fetch(stable)]);
  assert.equal(first.status, 200);
  assert.equal(first.url, coalesced.url);
  assert.match(first.url, /selected-[^/]+\/preview\.json$/);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await first.json(), pageArtifact().preview);
  assert.equal(calls, 1);
  const document = new URL(`snapshots/before/${page.route}`, first.url);
  assert.match(await (await fetch(document)).text(), /a{40}/);
  const head = await fetch(first.url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("cache-control"), "no-store");
  assert.equal(await head.text(), "");
  const refreshed = await fetch(`${stable}&refresh=1`);
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.url, first.url);
  assert.equal(calls, 2);
  for (const query of [
    `page=${page.route}&route=screens/removed.html`,
    `page=${page.route}&variant=default`,
    `page=${page.route}&page=${page.route}`,
    "page=../private.html",
  ])
    assert.equal(
      (await fetch(`${server.origin}/__mokly/diffs/review.json?${query}`))
        .status,
      404,
    );
  assert.equal(
    (
      await fetch(
        `${server.origin}/__mokly/diffs/review.json?page=archive/missing.html`,
      )
    ).status,
    500,
  );
});

test("page generation expiry reacquires without reviving an old URL", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const server = await start(t, {
    async generate(source, selection) {
      calls++;
      return pageArtifact(source, selection.route);
    },
  });
  const stable = `${server.origin}/__mokly/diffs/review.json?page=${encodeURIComponent(page.route)}`;
  const first = await fetch(stable);
  assert.equal(first.status, 200);
  now += 60_001;
  const recovered = await fetch(stable);
  assert.equal(recovered.status, 200);
  assert.notEqual(recovered.url, first.url);
  assert.equal((await fetch(first.url)).status, 404);
  assert.equal(calls, 2);
});

test("failed page refresh preserves the retained generation", async (t) => {
  let attempts = 0;
  const server = await start(t, {
    async generate(source, selection) {
      if (++attempts === 2) throw new Error("refresh failed");
      return pageArtifact(source, selection.route);
    },
  });
  const stable = `${server.origin}/__mokly/diffs/review.json?page=${encodeURIComponent(page.route)}`;
  const first = await fetch(stable);
  assert.equal(first.status, 200);
  assert.equal((await fetch(`${stable}&refresh=1`)).status, 500);
  assert.equal((await fetch(first.url)).status, 200);
  const retry = await fetch(`${stable}&refresh=1`);
  assert.equal(retry.status, 200);
  assert.notEqual(retry.url, first.url);
});

test("restore and redelete cycles cannot reuse a prior page selection", async (t) => {
  let source: RemovedPagePreviewSource | undefined = pageSource;
  let captures = 0;
  const provider: RemovedPagePreviewProvider = {
    async generate(accepted, selection) {
      captures++;
      assert.ok(
        accepted.removedEntries.some(
          ({ entry }) =>
            entry.kind === "page" && entry.route === selection.route,
        ),
      );
      return pageArtifact(accepted, selection.route);
    },
  };
  const server = await start(t, provider, {
    page: { provider, source: () => source },
  });
  const stable = `${server.origin}/__mokly/diffs/review.json?page=${encodeURIComponent(page.route)}`;
  const removed = await fetch(stable);
  assert.equal(removed.status, 200);
  source = undefined;
  server.routes.invalidate();
  assert.equal((await fetch(stable)).status, 500);
  source = { ...pageSource, baseCommit: "c".repeat(40) };
  server.routes.invalidate();
  const redeleted = await fetch(stable);
  assert.equal(redeleted.status, 200);
  assert.notEqual(redeleted.url, removed.url);
  assert.equal((await redeleted.json()).baseCommit, source.baseCommit);
  assert.equal(captures, 2);
});

test("page captures retry after failure and cannot publish across an epoch", async (t) => {
  let source = pageSource;
  let attempts = 0;
  let release = (): void => undefined;
  let captureStarted = (): void => undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    captureStarted = resolve;
  });
  const provider: RemovedPagePreviewProvider = {
    async generate(accepted, _selection, signal) {
      attempts++;
      if (attempts === 1) throw new Error("capture failed");
      if (attempts === 2) {
        captureStarted();
        await Promise.race([
          blocked,
          new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
        ]);
      }
      return pageArtifact(accepted);
    },
  };
  const server = await start(t, provider, {
    page: { provider, source: () => source },
  });
  const request = () =>
    fetch(
      `${server.origin}/__mokly/diffs/review.json?page=${encodeURIComponent(page.route)}`,
    );
  assert.equal((await request()).status, 500);
  const stale = request();
  await started;
  source = { ...pageSource, baseCommit: "b".repeat(40) };
  server.routes.invalidate();
  release();
  assert.equal((await stale).status, 500);
  const recovered = await request();
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).baseCommit, source.baseCommit);
});
