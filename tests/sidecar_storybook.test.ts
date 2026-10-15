import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

test("portable stories and parent views receive viewport and color globals", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: ["globals.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  for (const [method, target] of [
    ["renderStory", { storyId: "globals.stories.tsx#Primary" }],
    [
      "renderComponent",
      {
        handle: "globals.stories.tsx#default",
        slots: {},
        ignoreScope: "enabled",
      },
    ],
  ] as const) {
    const rendered = await sidecar.call<RenderResult>(method, {
      generation: bundled.generation,
      props: { label: "Overlay" },
      viewport: "mobile",
      colorScheme: "dark",
      ...target,
    });
    assert.equal(
      rendered.html,
      '<section data-viewport="mobile" data-scheme="dark"><button>Overlay</button></section>',
    );
  }
  await sidecar.call("shutdown");
});
