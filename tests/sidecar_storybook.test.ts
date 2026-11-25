import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

async function describeFixture(
  context: TestContext,
  storiesFiles: string[],
  directory = "",
) {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: new URL(`./fixtures/sidecar/${directory}`, import.meta.url)
        .pathname,
      entryFiles: [],
      renderer: null,
      storiesFiles,
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  return { sidecar, generation, definitions };
}

test("renderStory does not restore a data arg that the request omits", async (context) => {
  const { sidecar, generation } = await describeFixture(
    context,
    ["Button.stories.tsx"],
    "storybook-template",
  );
  await installBindings(sidecar, generation);
  const story = await sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: "Button.stories.tsx#Primary",
    props: { label: "Requested" },
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.equal(
    story.html,
    '<button type="button" class="storybook-button storybook-button--medium storybook-button--secondary">Requested</button>',
  );
});

test("CSF Factories render the first story as the parent with its decorators", async (context) => {
  const { sidecar, generation, definitions } = await describeFixture(
    context,
    ["button.stories.tsx"],
    "factories",
  );
  assert.deepEqual(definitions.diagnostics, []);
  const entry = definitions.components[0];
  assert.equal(entry?.title, "Factory Button");
  assert.deepEqual(entry.props, { label: "Primary" });
  assert.deepEqual(
    entry.variants.map(({ slug }) => slug),
    ["Secondary"],
  );
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
    props: entry.props,
    viewport: "mobile",
    colorScheme: "light",
  };
  const story = await sidecar.call<RenderResult>("renderStory", {
    ...axes,
    storyId: "button.stories.tsx#Primary",
  });
  const parent = await sidecar.call<RenderResult>("renderComponent", {
    ...axes,
    handle: "button.stories.tsx#default",
    entry: { path: "button", title: "Factory Button" },
    slots: {},
    ignoreScope: "enabled",
  });
  assert.equal(
    parent.html,
    '<section data-preview="factory"><strong><button>Primary</button></strong></section>',
  );
  assert.equal(story.html, parent.html);
});

test("untitled stories keep the component display name, component name, or file name", async (context) => {
  const { definitions } = await describeFixture(context, [
    "untitled-display.stories.tsx",
    "untitled-name.stories.tsx",
    "untitled-file.stories.tsx",
    "factories/untitled.stories.tsx",
  ]);
  assert.deepEqual(
    definitions.components.map(({ handle, title }) => ({ handle, title })),
    [
      {
        handle: "untitled-display.stories.tsx#default",
        title: "Display Button",
      },
      { handle: "untitled-name.stories.tsx#default", title: "NamedButton" },
      { handle: "untitled-file.stories.tsx#default", title: "untitled-file" },
      {
        handle: "factories/untitled.stories.tsx#default",
        title: "Untitled Factory Button",
      },
    ],
  );
});

test("stories retain composed control options for entry props they do not set", async (context) => {
  const { definitions } = await describeFixture(context, [
    "story-controls.stories.tsx",
  ]);
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

test("story names follow object names, legacy storyName, and Storybook start case", async (context) => {
  const { definitions } = await describeFixture(context, [
    "story-names.stories.tsx",
    "factories/untitled.stories.tsx",
  ]);
  assert.deepEqual(
    definitions.stories.map(({ title }) => title),
    [
      "Explicit Sidebar",
      "Legacy Sidebar",
      "Object Sidebar",
      "Large Button",
      "Function Button",
      "Large Button",
      "Named Factory",
    ],
  );
  assert.deepEqual(
    definitions.components.flatMap(({ variants }) =>
      variants.map(({ title }) => title),
    ),
    [
      "Legacy Sidebar",
      "Object Sidebar",
      "Large Button",
      "Function Button",
      "Named Factory",
    ],
  );
});

test("included stories keep custom tags and the first included component description", async (context) => {
  const { definitions } = await describeFixture(
    context,
    ["button.stories.tsx"],
    "story-metadata",
  );
  assert.deepEqual(definitions.diagnostics, []);
  assert.deepEqual(
    definitions.stories.map(({ id }) => id),
    [
      "button.stories.tsx#FirstIncluded",
      "button.stories.tsx#InheritedTags",
      "button.stories.tsx#EmptyTags",
    ],
  );
  const entry = definitions.components[0]!;
  assert.deepEqual(entry.tags, ["preview-tag", "first-tag"]);
  assert.equal(entry.description, "Included component description");
  assert.deepEqual(
    entry.variants.map(({ slug, tags, description }) => ({
      slug,
      tags,
      description,
    })),
    [
      {
        slug: "InheritedTags",
        tags: ["preview-tag", "meta-tag"],
        description: undefined,
      },
      { slug: "EmptyTags", tags: [], description: undefined },
    ],
  );
});

test("stories files without an included story give no entry and no warning", async (context) => {
  const { definitions } = await describeFixture(context, [
    "no-included.stories.tsx",
    "no-exports.stories.tsx",
  ]);
  assert.deepEqual(definitions.components, []);
  assert.deepEqual(definitions.stories, []);
  assert.deepEqual(definitions.diagnostics, []);
});

test("composed function and React element args stay out of data props without exclusions", async (context) => {
  const { sidecar, generation, definitions } = await describeFixture(context, [
    "story-args.stories.tsx",
    "story-non-data.stories.tsx",
  ]);
  assert.deepEqual(definitions.components[0]?.props, {
    label: "Story",
    empty: [],
  });
  assert.deepEqual(definitions.components[0]?.excludedProps, []);
  assert.deepEqual(definitions.stories[0]?.props, {
    label: "Story",
    empty: [],
  });
  assert.deepEqual(Object.keys(definitions.stories[0]!.argTypes).sort(), [
    "empty",
    "label",
  ]);
  assert.deepEqual(definitions.components[0]?.controlOrder, ["label", "empty"]);
  assert.deepEqual(definitions.stories[1]?.props, {});
  assert.deepEqual(definitions.components[1]?.excludedProps, [
    "value",
    "mixed",
  ]);
  await installBindings(sidecar, generation);
  const rendered = await sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: "story-args.stories.tsx#DataOnly",
    props: { label: "Edited" },
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.equal(
    rendered.html,
    "<button>Edited<span>Icon</span><i>Array icon</i> callback</button>",
  );
});

test("composed view globals reach story loaders, hooks, decorators, and markup", async (context) => {
  const file = "button.stories.tsx";
  const { sidecar, generation } = await describeFixture(
    context,
    [file],
    "story-view-globals",
  );
  await installBindings(sidecar, generation);
  for (const [viewport, colorScheme, density, globals] of [
    ["mobile", "dark", "compact", "dark/compact/fr/mobile/dark"],
    ["desktop", "light", "wide", "light/wide/fr/desktop/light"],
  ]) {
    const rendered = await sidecar.call<RenderResult>("renderStory", {
      generation,
      storyId: `${file}#Themed`,
      props: {},
      viewport,
      colorScheme,
    });
    assert.equal(
      rendered.html,
      `<section data-theme="${colorScheme}" data-density="${density}"><output>loader=${globals} hook=${globals} markup=${globals}</output></section>`,
      `${viewport} ${colorScheme}`,
    );
  }
});
