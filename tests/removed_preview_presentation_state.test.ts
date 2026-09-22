import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LoadedPreview } from "../packages/viewer/dist/previews/request.js";
import { ReadyPreview } from "../packages/viewer/dist/shell/previews.js";

const SNAPSHOT =
  "https://catalogue.test/__mokly/diffs/__generations/preview/snapshots/before/archive/removed.html";

test("an incomplete ready state renders the retryable unavailable state", () => {
  const loaded: LoadedPreview = {
    content: { kind: "page", url: SNAPSHOT },
    generation: "https://catalogue.test/__mokly/diffs/__generations/preview/",
    url: "https://catalogue.test/__mokly/diffs/__generations/preview/review.json",
  };
  let html = "";
  assert.doesNotThrow(() => {
    html = renderToStaticMarkup(
      createElement(ReadyPreview, {
        colorScheme: "light",
        data: {
          id: "removed-page",
          kind: "page",
          route: "archive/removed.html",
          title: "Removed page",
        },
        loaded,
        presentations: new Map(),
        retry: () => undefined,
        viewport: "both",
      }),
    );
  });
  assert.match(html, /<h2>Previous version unavailable<\/h2>/);
  assert.match(html, /The previous version could not be loaded\./);
  assert.match(html, /data-mokly-preview-retry=""[^>]*>Retry<\/button>/);
  assert.doesNotMatch(html, /<iframe/);
});
