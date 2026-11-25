import assert from "node:assert/strict";
import path from "node:path";
import test, { type TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  sidecarFixture,
  startSidecar,
} from "./helpers/sidecar.js";

async function describeStoryFile(
  context: TestContext,
  file: string,
  directory = ".",
) {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: path.join(sidecarFixture, directory),
      entryFiles: [],
      renderer: null,
      storiesFiles: [file],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  return { sidecar, generation, definitions };
}

test("CSF Factories describe and render a story after a helper export", async (context) => {
  const file = "factories/helper-before.stories.tsx";
  const { sidecar, generation, definitions } = await describeStoryFile(
    context,
    file,
  );
  assert.deepEqual(definitions.diagnostics, []);
  assert.deepEqual(
    definitions.stories.map(({ id }) => id),
    [`${file}#Primary`],
  );
  await installBindings(sidecar, generation);
  const story = await sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: `${file}#Primary`,
    props: definitions.stories[0]!.props,
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.equal(
    story.html,
    '<section data-preview="factory"><button>Primary</button></section>',
  );
});

test("CSF Factories omit helper objects and functions after a story", async (context) => {
  const file = "factories/helper-after.stories.tsx";
  const { definitions } = await describeStoryFile(context, file);
  assert.deepEqual(definitions.diagnostics, []);
  assert.deepEqual(definitions.components[0]?.variants, []);
  assert.deepEqual(
    definitions.stories.map(({ id }) => id),
    [`${file}#Primary`],
  );
});

test("CSF 3 stories use the composed definePreview settings", async (context) => {
  const file = "ordinary.stories.tsx";
  const { sidecar, generation } = await describeStoryFile(
    context,
    file,
    "factories",
  );
  await installBindings(sidecar, generation);
  const story = await sidecar.call<RenderResult>("renderStory", {
    generation,
    storyId: `${file}#Primary`,
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.equal(
    story.html,
    '<section data-preview="factory"><button>Ordinary story</button></section>',
  );
});

for (const { name, directory, html } of [
  {
    name: "CommonJS previews apply loaders and globals from exports.default",
    directory: "preview-commonjs-default",
    html: "<output>Loaded:default-theme</output>",
  },
  {
    name: "CommonJS previews apply named parameters beside exports.default",
    directory: "preview-commonjs-mixed",
    html: "<output>Loaded:preview-locale:dark-theme</output>",
  },
]) {
  test(name, async (context) => {
    const file = "entry.stories.tsx";
    const { sidecar, generation } = await describeStoryFile(
      context,
      file,
      directory,
    );
    await installBindings(sidecar, generation);
    const story = await sidecar.call<RenderResult>("renderStory", {
      generation,
      storyId: `${file}#Primary`,
      props: {},
      viewport: "mobile",
      colorScheme: "dark",
    });
    assert.equal(story.html, html);
  });
}

test("non-factory stories without a default export compose with empty meta", async (context) => {
  const file = "meta-less.stories.tsx";
  const { definitions } = await describeStoryFile(context, file);
  assert.deepEqual(definitions.diagnostics, []);
  assert.equal(definitions.components[0]?.title, "meta-less");
  assert.deepEqual(
    definitions.stories.map(({ id }) => id),
    [`${file}#Primary`],
  );
});
