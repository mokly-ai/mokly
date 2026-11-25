import type { ReactRenderer } from "@storybook/react";
import type { ReactNode } from "react";
import type {
  CleanupCallback,
  LegacyStoryFn,
  StoryContext,
} from "storybook/internal/csf";

import type { RenderResult } from "../generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../generated/sidecar/RenderStoryParams.js";

import type { Generation } from "./bundle.js";
import { readStoryParameters } from "./story-parameters.js";
import type { StoredStory } from "./story-reader.js";
import { setupStories } from "./story-setup.js";

type PreparedContext = StoryContext<ReactRenderer> & {
  unboundStoryFn?: LegacyStoryFn<ReactRenderer>;
};

export async function renderStory(
  generation: Generation,
  stored: StoredStory,
  params: Pick<RenderStoryParams, "props" | "viewport" | "colorScheme">,
  renderMarkup: (node: ReactNode) => RenderResult,
): Promise<RenderResult> {
  const cleanups: CleanupCallback[] = [];
  let renderFailed = false;
  try {
    await setupStories(generation, stored.beforeAll);
    let prepared: PreparedContext | undefined;
    const story = stored.compose(cleanups, (context) => {
      prepared = context;
    });
    const props = structuredClone(params.props);
    for (const key of stored.dataKeys) {
      if (!Object.hasOwn(props, key)) delete story.args[key];
    }
    Object.defineProperties(
      story.args,
      Object.getOwnPropertyDescriptors(props),
    );
    const { viewports, colorSchemes } = readStoryParameters(
      story.parameters.mokly,
    );
    Object.defineProperties(
      story.globals,
      Object.getOwnPropertyDescriptors({
        ...viewports.get(params.viewport),
        ...colorSchemes.get(params.colorScheme),
        moklyViewport: params.viewport,
        moklyColorScheme: params.colorScheme,
      }),
    );
    await story.load();
    const context = prepared;
    const unboundStoryFn = context?.unboundStoryFn;
    // A Storybook without the prepared render function keeps the portable call.
    return renderMarkup(
      generation.runtime.react.createElement(() =>
        context && typeof unboundStoryFn === "function"
          ? unboundStoryFn(context)
          : story(),
      ),
    );
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
