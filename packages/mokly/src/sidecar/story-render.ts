import type { setProjectAnnotations } from "@storybook/react";
import type { ReactNode } from "react";
import type {
  CleanupCallback,
  includeConditionalArg,
} from "storybook/internal/csf";

import type { RenderResult } from "../generated/sidecar/RenderResult.js";
import type { RenderStoryParams } from "../generated/sidecar/RenderStoryParams.js";

import type { Generation } from "./bundle.js";
import type { StoredStory } from "./story-reader.js";
import { setupStories } from "./story-setup.js";

type ProjectAnnotations = ReturnType<typeof setProjectAnnotations>;
type DecoratorApplicator = NonNullable<ProjectAnnotations["applyDecorators"]>;
type Args = Record<string, unknown>;

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

export function wrapStoryArgs(
  project: ProjectAnnotations,
  applyDecorators: DecoratorApplicator,
  includeArg?: typeof includeConditionalArg,
): void {
  let visibleArgs: Set<string>;
  if (!includeArg) {
    // Record Storybook's own conditional results before any authored loader
    // can change the context. Some versions do not export the predicate.
    project.loaders = [
      ({ args }) => {
        visibleArgs = new Set(Object.keys(args));
      },
      ...(project.loaders ?? []),
    ];
  }

  project.applyDecorators = (story, decorators) => {
    const decorated = applyDecorators(story, decorators);
    return (context) => {
      // The portable function replaces the prepared args with raw args before
      // calling the decorators. Keep the raw args for load() and the context.
      const rawArgs: Args = context.argsByTarget
        ? (context.argsByTarget.UNTARGETED ?? {})
        : (context.unmappedArgs ?? context.args);
      const mapped: Args = Object.fromEntries(
        Object.entries(rawArgs).map(([key, value]) => {
          const mapping = context.argTypes[key]?.mapping;
          if (!mapping) return [key, value];
          return [
            key,
            Array.isArray(value)
              ? value.map((item: unknown) => mapArg(item, mapping))
              : mapArg(value, mapping),
          ];
        }),
      );
      context.args = Object.fromEntries(
        Object.entries(mapped).filter(([key]) =>
          includeArg
            ? includeArg(context.argTypes[key] ?? {}, mapped, context.globals)
            : visibleArgs.has(key),
        ),
      );
      return decorated(context);
    };
  };
}

function mapArg(value: unknown, mapping: object): unknown {
  // Reflect applies Storybook's property-key coercion, including symbol keys.
  return Reflect.apply(Reflect.has, undefined, [mapping, value])
    ? Reflect.apply(Reflect.get, undefined, [mapping, value])
    : value;
}
