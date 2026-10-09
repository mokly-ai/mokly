import assert from "node:assert/strict";
import test from "node:test";

import { RenderStore } from "../dist/server/controls/store.js";
import type { TransientRender } from "../dist/server/controls/transient_assets.js";

const result: TransientRender = {
  route: "preview.html",
  props: {},
  view: {
    viewport: "mobile",
    colorScheme: "light",
    instances: [],
    slots: [],
    ranges: [],
    resources: [],
    insertedStylesheets: [],
  },
  files: new Map([
    [
      "preview.html",
      { type: "text/html", bytes: Buffer.from("<p>Preview</p>") },
    ],
  ]),
};
test("render bundles enforce count, bytes, expiry and foreign identity without an expired-id table", () => {
  let now = 0;
  const store = new RenderStore(() => now, 1000, 2, 100);
  const first = store.put(result, "generation");
  const second = store.put(result, "generation");
  store.put(result, "generation");
  assert.throws(() => store.get(first.renderId), { code: "expired" });
  assert.equal(store.get(second.renderId).route, "preview.html");
  assert.throws(() => store.get("bad"), { code: "unknown-entry" });
  assert.throws(() => new RenderStore().get(second.renderId), {
    code: "unknown-entry",
  });
  now = 100;
  assert.throws(() => store.get(second.renderId), { code: "expired" });
  const byteStore = new RenderStore(() => 0, 400);
  const old = byteStore.put(result, "g");
  byteStore.put(result, "g");
  byteStore.put(result, "g");
  assert.throws(() => byteStore.get(old.renderId), { code: "expired" });
  assert.throws(() => new RenderStore(() => 0, 1).put(result, "g"), {
    code: "render-failed",
  });
});
