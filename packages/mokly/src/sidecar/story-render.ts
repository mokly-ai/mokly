import type { ReactRenderer } from "@storybook/react";
import type { ReactNode } from "react";
import type {
  CleanupCallback,
  LegacyStoryFn,
  StoryContext,
} from "storybook/internal/csf";

import { AuthoringError } from "../authoring/errors.js";
import type { RenderSession } from "../authoring/runtime.js";
import type { RenderResult } from "../generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../generated/sidecar/RenderStoryParams.js";
import type { RenderStoryResult } from "../generated/sidecar/RenderStoryResult.js";

import type { Generation } from "./bundle.js";
import { SidecarError } from "./errors.js";
import { renderMarkup } from "./render-markup.js";
import { withRenderSession } from "./render-session.js";
import { readStoryParameters } from "./story-parameters.js";
import type { StoredStory } from "./story-reader.js";
import { storyReason } from "./story-reason.js";
import { setupStories } from "./story-setup.js";

type PreparedContext = StoryContext<ReactRenderer> & {
  unboundStoryFn?: LegacyStoryFn<ReactRenderer>;
};

class StoryWorkError extends Error {
  constructor(cause: unknown) {
    super("Story work failed", { cause });
  }
}

export function renderStory(
  generation: Generation,
  params: RenderStoryParams,
): Promise<RenderStoryResult> {
  return withRenderSession(
    generation,
    params.storyId,
    params,
    async (session) => {
      const stored = generation.stories.get(params.storyId)!;
      const { id: storyId, name } = stored;
      try {
        return await renderStoredStory(generation, stored, params, session);
      } catch (error) {
        if (!(error instanceof StoryWorkError)) throw error;
        const cause: unknown = error.cause;
        if (isFatalRenderError(cause)) throw cause;
        return { storyId, name, reason: storyReason(generation, cause) };
      }
    },
  );
}

function isFatalRenderError(
  error: unknown,
): error is SidecarError | AuthoringError {
  try {
    return error instanceof SidecarError || error instanceof AuthoringError;
  } catch {
    return false;
  }
}

async function renderStoredStory(
  generation: Generation,
  stored: StoredStory,
  params: RenderStoryParams,
  session: RenderSession,
): Promise<RenderResult> {
  const cleanups: CleanupCallback[] = [];
  let renderFailed = false;
  try {
    const Story = await prepareStory(generation, stored, params, cleanups);
    return renderMarkup(
      generation,
      session,
      generation.runtime.react.createElement(Story),
      {
        render(renderToStaticMarkup, node) {
          try {
            return renderToStaticMarkup(node);
          } catch (error) {
            throw new StoryWorkError(error);
          }
        },
      },
    );
  } catch (error) {
    renderFailed = true;
    throw error;
  } finally {
    await runCleanups(cleanups, renderFailed);
  }
}

async function prepareStory(
  generation: Generation,
  stored: StoredStory,
  params: RenderStoryParams,
  cleanups: CleanupCallback[],
): Promise<() => ReactNode> {
  const props = structuredClone(params.props);
  try {
    await setupStories(generation, stored.beforeAll);
    let prepared: PreparedContext | undefined;
    const story = stored.compose(cleanups, (context) => {
      prepared = context;
    });
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
    return () =>
      context && typeof unboundStoryFn === "function"
        ? unboundStoryFn(context)
        : story();
  } catch (error) {
    throw new StoryWorkError(error);
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
  if (!renderFailed && firstFailure)
    throw new StoryWorkError(firstFailure.error);
}
