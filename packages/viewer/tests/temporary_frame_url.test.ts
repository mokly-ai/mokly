import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import { FrameError } from "../src/client/frame_error.js";
import { temporaryFrameUrl } from "../src/client/frame_mount.js";

const ORIGIN = "http://127.0.0.1:4173";
const frame = { hasAttribute: () => false } as unknown as HTMLIFrameElement;
const usage: CatalogueUsage = {
  status: "ready",
  instances: [],
  slots: [],
  ranges: [],
};
// The form Serve answers: a counter and a tag, one opaque path segment.
const ID = `0000000000000005-${"f9".repeat(32)}`;
const mount = (path: string, origin = ORIGIN) =>
  temporaryFrameUrl(frame, { url: new URL(path, origin), usage }, ORIGIN);
const refused = (error: unknown) =>
  error instanceof FrameError && error.code === "origin";

test("a document below one opaque render id mounts", () => {
  const document = `/mokly-viewer/components/renders/${ID}/static/mokly-generated/components/button/index.mobile.html`;
  assert.equal(mount(document).pathname, document);
  assert.equal(
    mount("/mokly-viewer/components/renders/r-1/index.html").pathname,
    "/mokly-viewer/components/renders/r-1/index.html",
  );
});

test("a document outside one render bundle does not mount", () => {
  for (const path of [
    "/static/mokly-generated/components/button/index.mobile.html",
    "/mokly-viewer/components/renders/index.html",
    `/mokly-viewer/components/renders/${ID}/`,
    `/mokly-viewer/components/renders/${ID}/styles.css`,
    "/mokly-viewer/components/renders/bad%20id/index.html",
  ])
    assert.throws(() => mount(path), refused, path);
  assert.throws(
    () =>
      mount(
        `/mokly-viewer/components/renders/${ID}/index.html`,
        "http://other.test",
      ),
    refused,
  );
});
