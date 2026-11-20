import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
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

test("CSF Factories describe stories and render stories and the meta parent with the preview decorator", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: new URL("./fixtures/sidecar/factories", import.meta.url)
        .pathname,
      entryFiles: [],
      renderer: null,
      storiesFiles: ["button.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  assert.deepEqual(definitions.diagnostics, []);
  assert.equal(definitions.components[0]?.title, "Factory Button");
  assert.deepEqual(
    definitions.stories.map(({ id, props }) => ({ id, props })),
    [
      { id: "button.stories.tsx#Primary", props: { label: "Primary" } },
      { id: "button.stories.tsx#Secondary", props: { label: "Secondary" } },
    ],
  );
  await installBindings(sidecar, generation);
  const axes = {
    generation,
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  };
  const story = await sidecar.call<RenderResult>("renderStory", {
    ...axes,
    storyId: "button.stories.tsx#Primary",
  });
  assert.equal(
    story.html,
    '<section data-preview="factory"><button>Primary</button></section>',
  );
  const parent = await sidecar.call<RenderResult>("renderComponent", {
    ...axes,
    handle: "button.stories.tsx#default",
    entry: { path: "button", title: "Factory Button" },
    slots: {},
    ignoreScope: "enabled",
  });
  assert.equal(
    parent.html,
    '<section data-preview="factory"><button>Meta</button></section>',
  );
});

test("untitled stories keep the component display name, component name, or file name", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: [
        "untitled-display.stories.tsx",
        "untitled-name.stories.tsx",
        "untitled-file.stories.tsx",
      ],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  assert.deepEqual(
    definitions.components.map(({ handle, title }) => ({ handle, title })),
    [
      {
        handle: "untitled-display.stories.tsx#default",
        title: "Display Button",
      },
      { handle: "untitled-name.stories.tsx#default", title: "NamedButton" },
      { handle: "untitled-file.stories.tsx#default", title: "untitled-file" },
    ],
  );
});

test("stories retain composed control options for entry props they do not set", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: ["story-controls.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  assert.deepEqual(definitions.components[0]?.argTypes?.size?.options, [
    "small",
    "large",
  ]);
  assert.deepEqual(
    definitions.stories.map(({ id, argTypes }) => ({
      id,
      options: argTypes.size?.options,
    })),
    [
      {
        id: "story-controls.stories.tsx#WithSize",
        options: ["small", "large"],
      },
      {
        id: "story-controls.stories.tsx#WithoutSize",
        options: ["small", "large"],
      },
    ],
  );
  assert.equal(definitions.stories[1]?.argTypes.size?.name, "Optional size");
  assert.deepEqual(definitions.stories[1]?.props, { label: "Without size" });
});
