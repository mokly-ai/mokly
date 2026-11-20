import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { StoryHints } from "../generated/sidecar/StoryHints.js";

import type { BundleExports, Generation } from "./bundle.js";
import { dataProps } from "./definition-fields.js";
import { storyHints } from "./story-hints.js";
import { readStories } from "./story-reader.js";

export async function describeStories(
  generation: Generation,
  exports: BundleExports,
  result: Definitions,
): Promise<void> {
  if (!Object.keys(exports.stories).length) return;
  for (const [file, module] of Object.entries(exports.stories)) {
    const read = readStories(generation, exports, file, module);
    generation.stories.set(`${file}#default`, {
      compose: read.composeParent,
    });
    const excludedProps: string[] = [];
    const parent = {
      excludedProps,
      handle: `${file}#default`,
      title: read.title,
      description: "",
      relatedDocs: [],
      tags: [],
      props: storyProps(read.args, read.argTypes, excludedProps),
      argTypes: {} as Record<string, StoryHints>,
      variants: [] as Definitions["components"][number]["variants"],
      slots: [],
      stylesheets: [],
      useCasePaths: [],
      steps: [],
      controlOrder: [] as string[],
    };
    const variants = read.stories.map((entry) => {
      const hints = { ...read.argTypes, ...entry.inputArgTypes };
      const excludedProps: string[] = [];
      const props = storyProps(entry.story.args, hints, excludedProps);
      return { ...entry, props, excludedProps };
    });
    const dataKeys = new Set([
      ...Object.keys(parent.props),
      ...variants.flatMap((variant) => Object.keys(variant.props)),
    ]);
    for (const {
      exportName,
      title,
      story,
      compose,
      props,
      excludedProps,
    } of variants) {
      const id = `${file}#${exportName}`;
      result.stories.push({
        id,
        title,
        props: props as Definitions["stories"][number]["props"],
        argTypes: Object.fromEntries(
          Object.entries(story.argTypes)
            .filter(([key]) => dataKeys.has(key))
            .map(([key, value]) => [key, storyHints(value)]),
        ),
      });
      parent.variants.push({
        excludedProps,
        slug: exportName,
        title,
        props: props as Definitions["stories"][number]["props"],
        slots: {},
      });
      generation.stories.set(id, {
        compose,
        story,
      });
    }
    parent.controlOrder = [...dataKeys];
    parent.argTypes = Object.fromEntries(
      Object.entries(read.argTypes)
        .filter(([key]) => dataKeys.has(key))
        .map(([key, value]) => [key, storyHints(value)]),
    );
    result.components.push(parent as Definitions["components"][number]);
  }
}

function storyProps(
  args: Record<string, unknown>,
  hints: Record<string, Record<string, unknown>>,
  excluded: string[],
) {
  const kept = Object.fromEntries(
    Object.entries(args).filter(([key]) => {
      const hint = hints[key];
      const table = hint?.table as { disable?: boolean } | undefined;
      const type = hint?.type;
      return !(
        hint &&
        (hint.control === false ||
          table?.disable === true ||
          hint.action ||
          type === "function" ||
          (typeof type === "object" &&
            type !== null &&
            "name" in type &&
            type.name === "function"))
      );
    }),
  );
  return dataProps(kept, false, excluded);
}
