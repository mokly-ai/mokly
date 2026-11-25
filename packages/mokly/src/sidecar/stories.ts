import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { Story } from "../generated/sidecar/Story.js";

import type { BundleExports } from "./bundle-exports.js";
import type { Generation } from "./bundle.js";
import { dataProps } from "./definition-fields.js";
import type { ExportNameCache } from "./export-name-cache.js";
import { storyHints } from "./story-hints.js";
import { readStoryParameters } from "./story-parameters.js";
import { readStories, type StoredStory } from "./story-reader.js";

export function describeStoryFile(
  generation: Generation,
  file: string,
  module: Record<string, unknown>,
  preview: BundleExports["preview"],
  result: Definitions,
  cache: ExportNameCache,
): void {
  const read = readStories(generation, file, module, preview, cache);
  const handle = `${file}#default`;
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
  const dataKeys = new Set(stories.flatMap(({ props }) => Object.keys(props)));
  const [first, ...variants] = stories.map(
    ({ exportName, title, tags, story, compose, props, excludedProps }) => {
      const id = `${file}#${exportName}`;
      const argTypes = Object.fromEntries(
        Object.entries(story.argTypes)
          .filter(([key]) => dataKeys.has(key))
          .map(([key, value]) => [key, storyHints(value)]),
      );
      const stored: StoredStory = {
        componentHandle: handle,
        compose,
        beforeAll: read.beforeAll,
        dataKeys: Object.keys(props),
      };
      generation.stories.set(id, stored);
      result.stories.push({ id, title, props, argTypes });
      const { ignoredParameters } = readStoryParameters(story.parameters.mokly);
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
  if (!first) return;
  generation.storyComponents.register(read.component, handle);
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
