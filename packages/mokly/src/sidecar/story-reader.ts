import { createRequire } from "node:module";

import type * as Storybook from "@storybook/react";
import type * as Csf from "storybook/internal/csf";

import type { BundleExports, Generation } from "./bundle.js";
import type { ExportNameCache } from "./export-name-cache.js";
import { orderedExports } from "./export-order.js";

export type PortableStory = ReturnType<typeof Storybook.composeStory>;

export interface StoredStory {
  compose: () => PortableStory;
  beforeAll: ReturnType<typeof Storybook.setProjectAnnotations>["beforeAll"];
  dataKeys: readonly string[];
}

interface ReadStory {
  exportName: string;
  title: string;
  tags: string[];
  story: PortableStory;
  compose: StoredStory["compose"];
}

interface ReadStories {
  title: string;
  description: string;
  beforeAll: StoredStory["beforeAll"];
  stories: ReadStory[];
}

export function readStories(
  generation: Generation,
  exports: BundleExports,
  file: string,
  module: Record<string, unknown>,
  cache: ExportNameCache,
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
  const title = entryTitle(meta, file, factory !== undefined);
  const projectAnnotations = () =>
    storybook.setProjectAnnotations([{ tags: ["mokly"] }, annotations]);
  const project = projectAnnotations();

  // Storybook's runtime also accepts factory modules without a default export.
  const composeStories = storybook.composeStories as (
    module: Record<string, unknown>,
  ) => Record<string, PortableStory>;
  const compose = () => {
    // Project annotations are global. Reset them for every composition, also
    // when renders from different generations are interleaved.
    projectAnnotations();
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
  const stories = orderedExports(
    generation.sources.get(file) ?? "",
    composed,
    file,
    cache,
  )
    .filter(([exportName]) => {
      const tags = composed[exportName]!.tags;
      return tags.includes("dev") && tags.includes("mokly");
    })
    .map(([exportName]) => {
      const value = module[exportName];
      const authored = csf.isStory(value) ? value.input : value;
      const input = record(authored);
      return {
        exportName,
        title:
          (typeof authored !== "function" && typeof input.name === "string"
            ? input.name
            : undefined) ??
          (typeof input.storyName === "string" ? input.storyName : undefined) ??
          csf.storyNameFromExport(exportName),
        tags: customTags(composed[exportName]!.tags),
        story: composed[exportName]!,
        compose: () => compose()[exportName]!,
      };
    });
  const docs = record(stories[0]?.story.parameters.docs);
  const description = record(docs.description).component;
  return {
    title,
    description: typeof description === "string" ? description : "",
    beforeAll: project.beforeAll,
    stories,
  };
}

const builtInTags = new Set([
  "dev",
  "test",
  "mokly",
  "autodocs",
  "play-fn",
  "test-fn",
  "manifest",
  "attached-mdx",
  "unattached-mdx",
]);

function customTags(tags: readonly string[]): string[] {
  return tags.filter(
    (tag) => !builtInTags.has(tag) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag),
  );
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && (typeof value === "object" || typeof value === "function")
  );
}

function entryTitle(
  meta: Record<string, unknown>,
  file: string,
  factory: boolean,
): string {
  const component = record(meta.component);
  return (
    (typeof meta.title === "string" &&
    !(factory && meta.title === "ComposedStory")
      ? meta.title.split("/").at(-1)
      : undefined) ??
    (typeof component.displayName === "string"
      ? component.displayName
      : undefined) ??
    (typeof component.name === "string" ? component.name : undefined) ??
    file.split("/").at(-1)!.split(".")[0]!
  );
}
