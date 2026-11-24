import type { ReactNode } from "react";
import type { CleanupCallback } from "storybook/internal/csf";

import type { RenderResult } from "../generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../generated/sidecar/RenderStoryParams.js";

import type { Generation } from "./bundle.js";
import type { StoredStory } from "./story-reader.js";
import { setupStories } from "./story-setup.js";

export async function renderStory(
  generation: Generation,
  stored: StoredStory,
  params: Pick<RenderStoryParams, "props" | "viewport" | "colorScheme">,
  renderMarkup: (node: ReactNode) => RenderResult,
): Promise<RenderResult> {
  const cleanups: CleanupCallback[] = [];
  let renderFailed = false;
  try {
    const story = stored.compose(cleanups);
    const props = structuredClone(params.props);
    for (const key of stored.dataKeys) {
      if (!Object.hasOwn(props, key)) delete story.args[key];
    }
    Object.defineProperties(
      story.args,
      Object.getOwnPropertyDescriptors(props),
    );
    story.globals.moklyViewport = params.viewport;
    story.globals.moklyColorScheme = params.colorScheme;
    await setupStories(generation, stored.beforeAll);
    await story.load();
    return renderMarkup(generation.runtime.react.createElement(() => story()));
  } catch (error) {
    renderFailed = true;
    throw error;
  } finally {
    await runCleanups(cleanups, renderFailed);
  }
}

async function runCleanups(
  cleanups: CleanupCallback[],
  renderFailed: boolean,
): Promise<void> {
  let firstFailure: { error: unknown } | undefined;
  while (cleanups.length) {
    const cleanup = cleanups.pop()!;
    try {
      await cleanup();
    } catch (error) {
      firstFailure ??= { error };
    }
  }
  if (!renderFailed && firstFailure) throw firstFailure.error;
}
