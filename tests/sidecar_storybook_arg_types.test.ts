import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../packages/mokly/src/generated/sidecar/RenderStoryParams.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

async function prepareStory(context: TestContext, exportName: string) {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const file = "story-arg-types.stories.tsx";
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({ entryFiles: [], renderer: null, storiesFiles: [file] }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  await installBindings(sidecar, generation);
  const storyId = `${file}#${exportName}`;
  const story = definitions.stories.find(({ id }) => id === storyId);
  assert.ok(story);
  return {
    props: story.props,
    render: (
      props: RenderStoryParams["props"],
      colorScheme: RenderStoryParams["colorScheme"] = "light",
    ) =>
      sidecar.call<RenderResult>("renderStory", {
        generation,
        storyId,
        props,
        viewport: "mobile",
        colorScheme,
      }),
  };
}

test("story select mappings reach setup, decorators, and markup for saved and edited props", async (context) => {
  const { props, render } = await prepareStory(context, "Mapped");
  assert.deepEqual(props, { icon: "arrow" });
  const saved = await render(props);
  const edited = await render({ ...props, icon: "check" });
  const unmapped = await render({ ...props, icon: "label" });
  assert.deepEqual(
    [saved.html, edited.html, unmapped.html],
    [
      "<section><span><i>Arrow</i></span><output><span><i>Arrow</i></span><span><i>Arrow</i></span><span><i>Arrow</i></span></output></section>",
      "<section><span><b>Check</b></span><output><span><b>Check</b></span><span><b>Check</b></span><span><b>Check</b></span></output></section>",
      "<section><span>label</span><output><span>label</span><span>label</span><span>label</span></output></section>",
    ],
  );
});

test("story arg conditions omit hidden keys and use mapped args and view globals", async (context) => {
  const { props, render } = await prepareStory(context, "Conditional");
  const hidden = await render(props);
  const dark = await render(props, "dark");
  const edited = await render({ ...props, mode: "full" });
  assert.deepEqual(
    [hidden.html, dark.html, edited.html],
    [
      "<output>loader=absent/absent hook=absent/absent render=absent/absent</output>",
      "<output>loader=absent/Dark hint hook=absent/Dark hint render=absent/Dark hint</output>",
      "<output>loader=Extra/absent hook=Extra/absent render=Extra/absent</output>",
    ],
  );
});
