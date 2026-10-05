import assert from "node:assert/strict";
import test from "node:test";

import { readPreviewDescriptor } from "../src/previews/descriptor.js";
import { previewEndpoint, requestPreview } from "../src/previews/request.js";

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
  const comparisonUrl = `mokly-viewer/diffs/generations/${"a".repeat(64)}/review.json`;
  const request = previewEndpoint(
    data,
    { comparisonUrl },
    "https://example.test",
    false,
  );
  assert.ok(request);
  assert.ok(request.endpoint.pathname.endsWith("/previews/guide/index.json"));
  const loaded = await requestPreview(
    data,
    request,
    {
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
    previewEndpoint(data, undefined, "https://example.test", false)?.endpoint
      .search,
    "?page=guide",
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
