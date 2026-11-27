import assert from "node:assert/strict";

import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../../packages/mokly/src/generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../../packages/mokly/src/generated/sidecar/RenderStoryParams.js";
import type { RenderStoryResult } from "../../packages/mokly/src/generated/sidecar/RenderStoryResult.js";

import { bundleParams, installBindings, type startSidecar } from "./sidecar.js";

export async function prepare(
  sidecar: ReturnType<typeof startSidecar>,
  directory: string,
  entryFiles: string[] = [],
) {
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: new URL(`../fixtures/sidecar/${directory}/`, import.meta.url)
        .pathname,
      entryFiles,
      renderer: null,
      storiesFiles: ["entry.stories.tsx"],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  return generation;
}

export function callStory(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
  name = "Prepared",
  props: RenderStoryParams["props"] = {},
  viewport = "mobile",
  colorScheme = "light",
) {
  return sidecar.call<RenderStoryResult>("renderStory", {
    generation,
    storyId: `entry.stories.tsx#${name}`,
    props,
    viewport,
    colorScheme,
  });
}

export async function renderStory(...params: Parameters<typeof callStory>) {
  return expectRenderedStory(await callStory(...params));
}

export function expectRenderedStory(result: RenderStoryResult): RenderResult {
  assert.ok("html" in result, JSON.stringify(result));
  return result;
}

export function renderScreen(
  sidecar: ReturnType<typeof startSidecar>,
  generation: string,
) {
  return sidecar.call<RenderResult>("renderScreen", {
    generation,
    handle: "screen.mockup.tsx#screen",
    entry: { path: "screen", title: "Setup State" },
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
}
