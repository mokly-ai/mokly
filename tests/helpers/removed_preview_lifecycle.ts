import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type test from "node:test";

import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../../packages/mokly/dist/review/selection_types.js";
import type { SelectedReviewRoutesOptions } from "../../packages/mokly/dist/server/selected_review_capture.js";
import { SelectedReviewRoutes } from "../../packages/mokly/dist/server/selected_review_routes.js";
import { entryRoute } from "../../packages/viewer/dist/data.js";
import type { RemovedPagePreviewArtifact } from "../../packages/viewer/dist/review/page_preview.js";
import type { ReviewArtifact } from "../../packages/viewer/dist/review/types.js";

export const page = {
  declaredDependencies: [],
  description: "Removed page",
  path: "removed-page",
  kind: "page" as const,

  relatedDocs: [],
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};

export const baseline = {
  entries: [page],
  generatedBy: "mokly" as const,
  schemaVersion: 8 as const,
  folders: [],
  sourceFiles: [page.sourcePath],
};

export const pageSource: RemovedPagePreviewSource = {
  movedEntries: [],
  baseline,
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedEntries: [page.path],
  removedEntries: [{ folderTitles: [], entry: page }],
  schemaVersion: 2,
};

export const reviewSource: SelectedReviewSource = {
  after: {
    entries: [],
    generatedBy: "mokly",
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: [],
  },
  before: baseline,
  baseCommit: pageSource.baseCommit,
  baseRef: pageSource.baseRef,
  changedPaths: [],
  headDigests: {},
  result: {
    affectedConsumers: [],
    baseCommit: pageSource.baseCommit,
    baseRef: pageSource.baseRef,
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [],
    sharedImpact: [],
  },
};

export function pageArtifact(
  source = pageSource,
  id = page.path,
): RemovedPagePreviewArtifact {
  return {
    files: new Map([
      [
        `snapshots/before/${entryRoute(id)}`,
        Buffer.from(`<main>${source.baseCommit}</main>`),
      ],
    ]),
    preview: {
      schemaVersion: 3,
      baseCommit: source.baseCommit,
      baseRef: source.baseRef,
      path: id,
    },
  };
}

export function reviewArtifact(): ReviewArtifact {
  return {
    files: new Map([
      ["snapshots/before/removed/index.mobile.html", "before screen"],
    ]),
    result: {
      baseCommit: reviewSource.baseCommit,
      baseRef: reviewSource.baseRef,
      changedPaths: [],
      ignoredImpact: [],
      schemaVersion: 5 as const,
      screens: [],
      sharedImpact: [],
      components: [],
      changes: [],
      affectedConsumers: [],
    },
  };
}

export async function start(
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
