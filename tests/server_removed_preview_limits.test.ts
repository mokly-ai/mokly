import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
} from "../dist/review/selection_types.js";
import { SelectedReviewRoutes } from "../dist/server/selected_review_routes.js";

const route = "archive/removed.html";
const page = {
  declaredDependencies: [],
  dependencies: [],
  description: "Removed page",
  id: "removed-page",
  kind: "page" as const,
  navPath: [],
  relatedDocs: [],
  route,
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};
const source: RemovedPagePreviewSource = {
  baseline: {
    entries: [page],
    generatedBy: "mokly",
    schemaVersion: 5,
    sourceFiles: [],
  },
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedRoutes: [route],
  removedEntries: [{ entry: page, ancestors: [] }],
  schemaVersion: 1,
};

async function start(
  t: test.TestContext,
  provider: RemovedPagePreviewProvider,
  limits: {
    artifactBytes: number;
    capacityBytes: number;
    deadlineMs: number;
    generations: number;
    pending: number;
    retentionMs: number;
  },
) {
  const routes = new SelectedReviewRoutes({
    base: "main",
    page: { provider, source: () => source },
    limits,
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
  return (selected: string) =>
    fetch(
      `${origin}/__mokly/diffs/review.json?page=${encodeURIComponent(selected)}`,
    );
}

function artifact(selected: string, bytes = 16) {
  return {
    files: new Map([
      [`snapshots/before/${selected}`, Buffer.alloc(bytes, selected)],
    ]),
    preview: {
      schemaVersion: 1 as const,
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      route: selected,
      documentPath: `snapshots/before/${selected}`,
    },
  };
}

test("page generations enforce shared admission and deadlines", async (t) => {
  let started = (): void => undefined;
  const arrived = new Promise<void>((resolve) => {
    started = resolve;
  });
  const request = await start(
    t,
    {
      async generate(_source, selection, signal) {
        started();
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        signal.throwIfAborted();
        return artifact(selection.route);
      },
    },
    {
      artifactBytes: 1_024,
      capacityBytes: 2_048,
      deadlineMs: 50,
      generations: 64,
      pending: 2,
      retentionMs: 60_000,
    },
  );
  const first = request(route);
  await arrived;
  const second = request("archive/second.html");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await request("archive/third.html")).status, 500);
  assert.equal((await first).status, 500);
  assert.equal((await second).status, 500);
});

test("page generations enforce shared artifact and retained-capacity bounds", async (t) => {
  const request = await start(
    t,
    {
      async generate(_source, selection) {
        return artifact(selection.route, 700);
      },
    },
    {
      artifactBytes: 1_024,
      capacityBytes: 1_500,
      deadlineMs: 10_000,
      generations: 64,
      pending: 32,
      retentionMs: 60_000,
    },
  );
  assert.equal((await request(route)).status, 200);
  assert.equal((await request("archive/second.html")).status, 500);

  const oversized = await start(
    t,
    {
      async generate(_source, selection) {
        return artifact(selection.route, 1_100);
      },
    },
    {
      artifactBytes: 1_024,
      capacityBytes: 4_096,
      deadlineMs: 10_000,
      generations: 64,
      pending: 32,
      retentionMs: 60_000,
    },
  );
  assert.equal((await oversized(route)).status, 500);
});
