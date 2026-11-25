import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { Story } from "../generated/sidecar/Story.js";

import type { BundleExports, Generation } from "./bundle.js";
import { dataProps } from "./definition-fields.js";
import type { ExportNameCache } from "./export-name-cache.js";
import { storyHints } from "./story-hints.js";
import { readStoryParameters } from "./story-parameters.js";
import { readStories, type StoredStory } from "./story-reader.js";

export async function describeStories(
  generation: Generation,
  exports: BundleExports,
  result: Definitions,
  cache: ExportNameCache,
): Promise<void> {
  if (!Object.keys(exports.stories).length) return;
  for (const [file, module] of Object.entries(exports.stories)) {
    const read = readStories(generation, exports, file, module, cache);
    const stories = read.stories.map((entry) => {
      const excludedProps: string[] = [];
      const props = storyProps(
        generation,
        entry.story.args,
        entry.story.argTypes,
        excludedProps,
      );
      return { ...entry, props, excludedProps };
    });
    const dataKeys = new Set(
      stories.flatMap(({ props }) => Object.keys(props)),
    );
    const [first, ...variants] = stories.map(
      ({ exportName, title, tags, story, compose, props, excludedProps }) => {
        const id = `${file}#${exportName}`;
        const argTypes = Object.fromEntries(
          Object.entries(story.argTypes)
            .filter(([key]) => dataKeys.has(key))
            .map(([key, value]) => [key, storyHints(value)]),
        );
        const stored: StoredStory = {
          compose,
          beforeAll: read.beforeAll,
          dataKeys: Object.keys(props),
        };
        generation.stories.set(id, stored);
        result.stories.push({ id, title, props, argTypes });
        const { ignoredParameters } = readStoryParameters(
          story.parameters.mokly,
        );
        return {
          saved: {
            slug: exportName,
            title,
            tags,
            props,
            excludedProps,
            ...(ignoredParameters.length ? { ignoredParameters } : {}),
          },
          argTypes,
          stored,
        };
      },
    );
    if (!first) continue;
    const handle = `${file}#default`;
    generation.stories.set(handle, first.stored);
    result.components.push({
      excludedProps: first.saved.excludedProps,
      ...(first.saved.ignoredParameters
        ? { ignoredParameters: first.saved.ignoredParameters }
        : {}),
      handle,
      title: read.title,
      description: read.description,
      relatedDocs: [],
      tags: first.saved.tags,
      props: first.saved.props,
      argTypes: first.argTypes,
      variants: variants.map(({ saved }) => ({ ...saved, slots: {} })),
      slots: [],
      stylesheets: [],
      useCasePaths: [],
      steps: [],
      controlOrder: [...dataKeys],
    });
  }
}

function storyProps(
  generation: Generation,
  args: Record<string, unknown>,
  hints: Record<string, Record<string, unknown>>,
  excluded: string[],
): Story["props"] {
  const element = generation.runtime.react.isValidElement;
  const kept = Object.fromEntries(
    Object.entries(args).filter(([key, value]) => {
      const hint = hints[key];
      const type = hint?.type;
      return !(
        element(value) ||
        (Array.isArray(value) && value.length > 0 && value.every(element)) ||
        (hint &&
          (hint.control === false ||
            disabled(hint.control) ||
            disabled(hint.table) ||
            hint.action ||
            type === "function" ||
            (typeof type === "object" &&
              type !== null &&
              "name" in type &&
              type.name === "function")))
      );
    }),
  );
  return dataProps(kept, false, excluded) as Story["props"];
}

function disabled(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "disable" in value &&
    value.disable === true
  );
}
