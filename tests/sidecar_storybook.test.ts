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

test("CSF Factories describe stories and render stories and the meta parent with the preview decorator", async (context) => {
  const { sidecar, generation, definitions } = await describeFixture(
    context,
    ["button.stories.tsx"],
    "factories",
  );
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
      "Explicit Sidebar",
      "Legacy Sidebar",
      "Object Sidebar",
      "Large Button",
      "Function Button",
      "Large Button",
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
        slug: "FirstIncluded",
        tags: ["preview-tag", "first-tag"],
        description: undefined,
      },
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
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: [],
      renderer: null,
      storiesFiles: ["story-args.stories.tsx", "story-non-data.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  assert.deepEqual(definitions.components[0]?.props, { label: "Meta" });
  assert.deepEqual(definitions.components[0]?.excludedProps, []);
  assert.deepEqual(definitions.stories[0]?.props, {
    label: "Story",
    empty: [],
  });
  assert.deepEqual(definitions.components[0]?.variants[0]?.excludedProps, []);
  assert.deepEqual(Object.keys(definitions.stories[0]!.argTypes).sort(), [
    "empty",
    "label",
  ]);
  assert.deepEqual(definitions.components[0]?.controlOrder, ["label", "empty"]);
  assert.deepEqual(definitions.stories[1]?.props, {});
  assert.deepEqual(definitions.components[1]?.variants[0]?.excludedProps, [
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
