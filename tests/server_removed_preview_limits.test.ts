import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
} from "../dist/review/selection_types.js";
import { SelectedReviewRoutes } from "../dist/server/selected_review_routes.js";

import { currentManifest } from "./helpers/current_manifest.js";

const id = "removed-page";
const page = {
  declaredDependencies: [],
  description: "Removed page",
  id,
  kind: "page" as const,
  navPath: [],
  relatedDocs: [],
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};
const source: RemovedPagePreviewSource = {
  baseline: currentManifest({
    entries: [page],
    generatedBy: "mokly",
    schemaVersion: 8,
    sourceFiles: [page.sourcePath],
  }),
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedIds: [id],
  removedEntries: [{ entry: page }],
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
      [
        `snapshots/before/mokly-generated/pages/${selected}.html`,
        Buffer.alloc(bytes, selected),
      ],
    ]),
    preview: {
      schemaVersion: 2 as const,
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      id: selected,
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
        return artifact(selection.id);
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
  const first = request(id);
  await arrived;
  const second = request("second");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await request("third")).status, 500);
  assert.equal((await first).status, 500);
  assert.equal((await second).status, 500);
});

test("page generations enforce shared artifact and retained-capacity bounds", async (t) => {
  const request = await start(
    t,
    {
      async generate(_source, selection) {
        return artifact(selection.id, 700);
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
  assert.equal((await request(id)).status, 200);
  assert.equal((await request("second")).status, 500);

  const oversized = await start(
    t,
    {
      async generate(_source, selection) {
        return artifact(selection.id, 1_100);
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
  assert.equal((await oversized(id)).status, 500);
});
