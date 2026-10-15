import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

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
  await installBindings(sidecar, bundled.generation);
  for (const [method, target] of [
    ["renderStory", { storyId: "globals.stories.tsx#Primary" }],
    [
      "renderComponent",
      {
        handle: "globals.stories.tsx#default",
        entry: { path: "globals", title: "Globals" },
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

test("preview decorators apply once and stay isolated between interleaved generations", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const generations: string[] = [];
  for (const name of ["a", "b"]) {
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: new URL(
          `./fixtures/sidecar/preview-${name}`,
          import.meta.url,
        ).pathname,
        entryFiles: [],
        renderer: null,
        storiesFiles: ["entry.stories.tsx"],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(sidecar, generation);
    generations.push(generation);
  }
  for (const index of [0, 1, 0]) {
    const generation = generations[index]!;
    const expected = `<div data-preview="${index === 0 ? "a" : "b"}"><button>Story</button></div>`;
    const axes = {
      generation,
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    };
    assert.equal(
      (
        await sidecar.call<RenderResult>("renderStory", {
          ...axes,
          storyId: "entry.stories.tsx#Primary",
        })
      ).html,
      expected,
    );
    assert.equal(
      (
        await sidecar.call<RenderResult>("renderComponent", {
          ...axes,
          entry: { path: "entry", title: "Preview" },
          handle: "entry.stories.tsx#default",
          slots: {},
          ignoreScope: "enabled",
        })
      ).html,
      expected,
    );
  }
});
