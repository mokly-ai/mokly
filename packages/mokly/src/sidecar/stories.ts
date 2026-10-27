import type * as Storybook from "@storybook/react";

import type { Definitions } from "../generated/sidecar/Definitions.js";
import type { StoryHints } from "../generated/sidecar/StoryHints.js";

import type { BundleExports, Generation } from "./bundle.js";
import { dataProps } from "./definition-fields.js";
import { orderedExports } from "./export-order.js";
import { storyHints } from "./story-hints.js";

interface StoryAnnotations {
  args?: Record<string, unknown>;
  argTypes?: Record<string, Record<string, unknown>>;
  name?: string;
  title?: string;
  component?: { displayName?: string; name?: string };
}
export interface PortableStory {
  (props: Record<string, unknown>): unknown;
  args: Record<string, unknown>;
  globals: Record<string, unknown>;
}

export async function describeStories(
  generation: Generation,
  exports: BundleExports,
  result: Definitions,
): Promise<void> {
  if (!Object.keys(exports.stories).length) return;
  const storybook = generation.require("@storybook/react") as typeof Storybook;
  const annotations = exports.preview?.default ?? exports.preview ?? {};

  for (const [file, module] of Object.entries(exports.stories)) {
    const meta = (module.default ?? {}) as StoryAnnotations;
    // Storybook keeps project annotations in global state, so each
    // composition sets this generation's preview first. They are not passed
    // to `composeStories` too, which would apply them a second time.
    const compose = () => {
      storybook.setProjectAnnotations(annotations);
      return storybook.composeStories({
        ...module,
        default: module.default ?? {},
      });
    };
    const composed = compose() as Record<string, PortableStory>;
    generation.stories.set(`${file}#default`, {
      compose: () => {
        storybook.setProjectAnnotations(annotations);
        return storybook.composeStory(
          {},
          module.default as Parameters<typeof storybook.composeStory>[1],
          undefined,
          "MoklyDefault",
        );
      },
    });
    const excludedProps: string[] = [];
    const parent = {
      excludedProps,
      handle: `${file}#default`,
      title:
        meta.title?.split("/").at(-1) ??
        meta.component?.displayName ??
        meta.component?.name ??
        file.split("/").at(-1)!.split(".")[0]!,
      description: "",
      relatedDocs: [],
      tags: [],
      props: storyProps(
        generation,
        meta.args ?? {},
        meta.argTypes ?? {},
        `${file}#default`,
        excludedProps,
      ),
      argTypes: {} as Record<string, StoryHints>,
      variants: [] as Definitions["components"][number]["variants"],
      slots: [],
      stylesheets: [],
      useCasePaths: [],
      steps: [],
      controlOrder: [] as string[],
    };
    for (const [exportName, value] of orderedExports(
      generation.sources.get(file) ?? "",
      composed,
      file,
    )) {
      const story = value as PortableStory;
      const annotation = module[exportName] as StoryAnnotations;
      const id = `${file}#${exportName}`;
      const hints = { ...meta.argTypes, ...annotation.argTypes };
      const excludedProps: string[] = [];
      const props = storyProps(
        generation,
        story.args,
        hints,
        id,
        excludedProps,
      );
      const title = annotation.name ?? exportName;
      const argTypes: Record<string, StoryHints> = {};
      for (const [key, value] of Object.entries(hints)) {
        if (!Object.hasOwn(props, key)) continue;
        argTypes[key] = storyHints(value);
      }
      result.stories.push({
        id,
        title,
        props: props as Definitions["stories"][number]["props"],
        argTypes,
      });
      parent.variants.push({
        excludedProps,
        slug: exportName,
        title,
        props: props as Definitions["stories"][number]["props"],
        slots: {},
      });
      generation.stories.set(id, {
        compose: () =>
          (compose() as Record<string, PortableStory>)[exportName]!,
        story,
      });
    }
    const dataKeys = new Set([
      ...Object.keys(parent.props),
      ...parent.variants.flatMap((variant) => Object.keys(variant.props)),
    ]);
    parent.controlOrder = [...dataKeys];
    parent.argTypes = Object.fromEntries(
      Object.entries(meta.argTypes ?? {})
        .filter(([key]) => dataKeys.has(key))
        .map(([key, value]) => [key, storyHints(value)]),
    );
    result.components.push(parent as Definitions["components"][number]);
  }
}

function storyProps(
  generation: Generation,
  args: Record<string, unknown>,
  hints: Record<string, Record<string, unknown>>,
  location: string,
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
  return dataProps(kept, false, location, generation.warnings, excluded);
}
