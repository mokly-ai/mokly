import { createRequire } from "node:module";

import type * as Storybook from "@storybook/react";
import type * as Csf from "storybook/internal/csf";

import type { BundleExports, Generation } from "./bundle.js";
import { orderedExports } from "./export-order.js";

export type PortableStory = ReturnType<typeof Storybook.composeStory>;

type ArgTypes = Record<string, Record<string, unknown>>;

interface ReadStory {
  exportName: string;
  title: string;
  inputArgTypes: ArgTypes;
  story: PortableStory;
  compose: () => PortableStory;
}

interface ReadStories {
  title: string;
  args: Record<string, unknown>;
  argTypes: ArgTypes;
  composeParent: () => PortableStory;
  stories: ReadStory[];
}

export function readStories(
  generation: Generation,
  exports: BundleExports,
  file: string,
  module: Record<string, unknown>,
): ReadStories {
  const storybook = generation.require("@storybook/react") as typeof Storybook;
  const require = createRequire(generation.require.resolve("@storybook/react"));
  const csf = require("storybook/internal/csf") as typeof Csf;
  const factory = Object.values(module).find(csf.isStory);
  const meta = record(module.default ?? factory?.meta.input);
  const preview =
    factory?.meta.preview ?? exports.preview?.default ?? exports.preview ?? {};
  const annotations = csf.isPreview(preview)
    ? preview.composed
    : record(preview);
  const title = entryTitle(meta, file);

  // Storybook's runtime also accepts factory modules without a default export.
  const composeStories = storybook.composeStories as (
    module: Record<string, unknown>,
  ) => Record<string, PortableStory>;
  const compose = () => {
    // Project annotations are global. Reset them for every composition, also
    // when renders from different generations are interleaved.
    storybook.setProjectAnnotations(annotations);
    const copied = Object.fromEntries(
      Object.entries(module).map(([name, value]) => [
        name,
        name === "default"
          ? { ...meta }
          : csf.isStory(value)
            ? {
                _tag: value._tag,
                input: { ...value.input },
                meta: { ...value.meta, input: { ...value.meta.input } },
              }
            : value,
      ]),
    );
    return composeStories(copied);
  };
  const composed = compose();
  return {
    title,
    args: record(meta.args),
    argTypes: argTypes(meta.argTypes),
    composeParent: () => {
      storybook.setProjectAnnotations(annotations);
      return storybook.composeStory({}, { ...meta }, undefined, "MoklyDefault");
    },
    stories: orderedExports(
      generation.sources.get(file) ?? "",
      composed,
      file,
    ).map(([exportName]) => {
      const value = module[exportName];
      const input = record(csf.isStory(value) ? value.input : value);
      return {
        exportName,
        title: typeof input.name === "string" ? input.name : exportName,
        inputArgTypes: argTypes(input.argTypes),
        story: composed[exportName]!,
        compose: () => compose()[exportName]!,
      };
    }),
  };
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && (typeof value === "object" || typeof value === "function")
  );
}

function argTypes(value: unknown): ArgTypes {
  return Object.fromEntries(
    Object.entries(record(value)).map(([key, hint]) => [key, record(hint)]),
  );
}

function entryTitle(meta: Record<string, unknown>, file: string): string {
  const component = record(meta.component);
  return (
    (typeof meta.title === "string"
      ? meta.title.split("/").at(-1)
      : undefined) ??
    (typeof component.displayName === "string"
      ? component.displayName
      : undefined) ??
    (typeof component.name === "string" ? component.name : undefined) ??
    file.split("/").at(-1)!.split(".")[0]!
  );
}
