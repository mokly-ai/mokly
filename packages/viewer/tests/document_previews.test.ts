import assert from "node:assert/strict";
import test from "node:test";

import { readPreviewDescriptor } from "../src/previews/descriptor.js";
import { previewEndpoint, requestPreview } from "../src/previews/request.js";

import { indexFixture, rawDetailFixtures } from "./catalogue_v9_fixture.js";

test("removed document descriptors and requests retain historical schemes", async () => {
  const data = readPreviewDescriptor(
    JSON.stringify({
      path: "guide",
      kind: "document",
      title: "Guide",
      colorSchemes: ["light", "dark"],
      published: { kind: "document" },
    }),
  );
  assert.ok(data);
  const comparisonUrl = `mokly-viewer/diffs/generations/${"a".repeat(64)}/`;
  const request = previewEndpoint(
    data,
    { comparisonUrl },
    "https://example.test",
  );
  assert.ok(request);
  assert.ok(request.endpoint.pathname.endsWith("/previews/guide/index.json"));
  let deploymentChecks = 0;
  const loaded = await requestPreview(
    data,
    request,
    {
      deploymentCheck: async () => {
        deploymentChecks += 1;
        return true;
      },
      fetch: async () => {
        const response = Response.json({
          schemaVersion: 3,
          path: "guide",
          baseCommit: "b".repeat(40),
          baseRef: "main",
        });
        Object.defineProperty(response, "url", {
          value: request.endpoint.href,
        });
        return response;
      },
    },
    new AbortController().signal,
  );
  assert.ok(loaded.content.kind === "document");
  assert.equal(deploymentChecks, 1);
  assert.deepEqual(
    loaded.content.views.map((view) => [
      view.colorScheme,
      new URL(view.url).pathname,
    ]),
    [
      [
        "light",
        `/mokly-viewer/diffs/generations/${"a".repeat(64)}/snapshots/before/mokly-generated/guide/index.html`,
      ],
      [
        "dark",
        `/mokly-viewer/diffs/generations/${"a".repeat(64)}/snapshots/before/mokly-generated/guide/index.dark.html`,
      ],
    ],
  );
  assert.equal(
    previewEndpoint(data, undefined, "https://example.test"),
    undefined,
  );
  assert.equal(
    previewEndpoint(data, { comparisonUrl: null }, "https://example.test"),
    undefined,
  );
  for (const colorSchemes of [
    undefined,
    [],
    ["dark"],
    ["light", "other"],
    ["light", "light"],
  ])
    assert.equal(
      readPreviewDescriptor(JSON.stringify({ ...data, colorSchemes })),
      undefined,
    );
});

test("a removed screen's preview reads its removed detail inside the generation", async () => {
  const fixtures = rawDetailFixtures();
  const [snapshotId, detail] = Object.entries(fixtures.removed).find(
    ([, candidate]) => candidate.entry.kind === "screen",
  )!;
  const path = detail.entry.path;
  const root = indexFixture().comparisonUrl!;
  const data = {
    path,
    kind: "screen" as const,
    title: "Retired",
    catalogueIdentity: detail.identity.id,
    snapshotId,
    published: { kind: "screen" as const },
  };
  const request = previewEndpoint(
    data,
    { comparisonUrl: root },
    "https://example.test",
  );
  assert.ok(request);
  assert.equal(
    request.endpoint.href,
    `https://example.test/${root}entries/${path}.json`,
  );
  assert.equal(request.generation.href, `https://example.test/${root}`);
  const fetch = async (payload: unknown) => {
    const response = Response.json(payload);
    Object.defineProperty(response, "url", { value: request.endpoint.href });
    return response;
  };
  const loaded = await requestPreview(
    data,
    request,
    { fetch: () => fetch(detail) },
    new AbortController().signal,
  );
  assert.ok(loaded.content.kind === "screen");
  assert.deepEqual(
    loaded.content.views.map((view) => new URL(view.url).pathname),
    detail.views.map(
      (view) =>
        `/${root}snapshots/before/mokly-generated/${path}/index.${view.viewport}${view.colorScheme === "dark" ? ".dark" : ""}.html`,
    ),
  );
  await assert.rejects(
    requestPreview(
      { ...data, snapshotId: "c".repeat(64) },
      request,
      { fetch: () => fetch(detail) },
      new AbortController().signal,
    ),
    /The previous version is unavailable/,
  );
});
