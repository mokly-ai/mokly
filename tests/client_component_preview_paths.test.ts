import assert from "node:assert/strict";
import test from "node:test";

import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
  GeneratedComponentView,
} from "@mokly/viewer/data";

import { requestComponentPreview } from "../dist/client/react_transports.js";

const capability = {
  generation: "accepted-generation",
  token: "private-token",
};
const request: ComponentRenderRequest = {
  componentId: "action",
  variantId: "action-default",
  pageId: "action",
  viewport: "desktop",
  colorScheme: "light",
  generation: capability.generation,
  overrides: { label: { kind: "set", value: ["string", "Purchase"] } },
};
const view: GeneratedComponentView = {
  viewport: "desktop",
  colorScheme: "light",
  path: "components/action-default.desktop.html",
};
const renderId = `${"a".repeat(48)}.${"b".repeat(64)}`;
const preview: ComponentRenderSuccess = {
  generation: capability.generation,
  renderId,
  previewUrl: `/__mokly/components/renders/${renderId}/mokly-generated/components/action-default.desktop.html`,
  props: { label: ["string", "Purchase"] },
  view: {
    viewport: "desktop",
    colorScheme: "light",
    instances: [],
    ranges: [],
    slots: [],
    styles: [],
    resources: [],
  },
};

test("temporary preview transport accepts the generated layout and confines each response", async (t) => {
  let response = preview;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      assert.equal(
        (options.headers as Record<string, string>)["x-mokly-render-token"],
        capability.token,
      );
      return Response.json(response);
    },
  );
  const send = () =>
    requestComponentPreview(
      request,
      capability,
      view,
      new AbortController().signal,
    );
  assert.deepEqual(await send(), preview);
  for (const changed of [
    {
      previewUrl: `/__mokly/components/renders/${renderId}/components/action-default.desktop.html`,
    },
    { previewUrl: preview.previewUrl.replace("action-default", "other") },
    {
      previewUrl: preview.previewUrl.replace(
        renderId,
        `${"c".repeat(48)}.${"b".repeat(64)}`,
      ),
    },
    { generation: "superseded-generation" },
  ]) {
    response = { ...preview, ...changed };
    await assert.rejects(send, /preview response could not be read/);
  }
});
