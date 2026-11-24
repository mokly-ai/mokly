import { createRequire } from "node:module";

import type * as Storybook from "@storybook/react";
import type * as Csf from "storybook/internal/csf";

import type { BundleExports, Generation } from "./bundle.js";
import type { ExportNameCache } from "./export-name-cache.js";
import { orderedExports } from "./export-order.js";

export type PortableStory = ReturnType<typeof Storybook.composeStory>;

type ProjectAnnotations = ReturnType<typeof Storybook.setProjectAnnotations>;
type BeforeEach = NonNullable<ProjectAnnotations["beforeEach"]>;

export interface StoredStory {
  compose: (cleanups: Csf.CleanupCallback[]) => PortableStory;
  beforeAll: ProjectAnnotations["beforeAll"];
  dataKeys: readonly string[];
}

interface RenderComposition {
  exportName: string;
  cleanups: Csf.CleanupCallback[];
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
  // Storybook's runtime also accepts factory modules without a default export.
  const composeStories = storybook.composeStories as (
    module: Record<string, unknown>,
  ) => Record<string, PortableStory>;
  const compose = (render?: RenderComposition) => {
    // Project annotations are global. Reset them for every composition, also
    // when renders from different generations are interleaved.
    const project = storybook.setProjectAnnotations([
      { tags: ["mokly"] },
      annotations,
    ]);
    const { beforeAll, beforeEach } = project;
    const wrap = (value: unknown) =>
      render ? wrapStoryHooks(value, render.cleanups) : value;
    // The combined project hooks include core and addon hooks.
    if (render && beforeEach)
      project.beforeEach = wrapBeforeEach(beforeEach, render.cleanups);
    try {
      const copied = Object.fromEntries(
        Object.entries(module).map(([name, value]) => [
          name,
          name === "default"
            ? wrap({ ...meta })
            : csf.isStory(value)
              ? {
                  _tag: value._tag,
                  input: wrap({ ...value.input }),
                  meta: { ...value.meta, input: wrap({ ...value.meta.input }) },
                }
              : name === render?.exportName
                ? wrap(value)
                : value,
        ]),
      );
      return { stories: composeStories(copied), beforeAll };
    } finally {
      if (beforeEach) project.beforeEach = beforeEach;
    }
  };
  const { stories: composed, beforeAll } = compose();
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
        compose: (cleanups: Csf.CleanupCallback[]) =>
          compose({ exportName, cleanups }).stories[exportName]!,
      };
    });
  const docs = record(stories[0]?.story.parameters.docs);
  const description = record(docs.description).component;
  return {
    title,
    description: typeof description === "string" ? description : "",
    beforeAll,
    stories,
  };
}

interface HookAnnotations {
  beforeEach?: BeforeEach;
  story?: Pick<HookAnnotations, "beforeEach">;
}

function wrapStoryHooks(
  value: unknown,
  cleanups: Csf.CleanupCallback[],
): unknown {
  if (!isRecord(value)) return value;
  const { beforeEach, story } = value as HookAnnotations;
  if (!beforeEach && !story?.beforeEach) return value;

  const overrides = {
    ...(beforeEach && { beforeEach: wrapBeforeEach(beforeEach, cleanups) }),
    ...(story?.beforeEach && {
      story: {
        ...story,
        beforeEach: wrapBeforeEach(story.beforeEach, cleanups),
      },
    }),
  };
  const descriptors = {
    ...Object.getOwnPropertyDescriptors(value),
    ...Object.getOwnPropertyDescriptors(overrides),
  };
  const prototype = Object.getPrototypeOf(value);
  if (typeof value !== "function") return Object.create(prototype, descriptors);

  // A CSF 2 story must stay callable and keep its arity for argType inference.
  const render = value;
  function copied(this: unknown, ...args: unknown[]): unknown {
    return Reflect.apply(render, this, args);
  }
  return Object.defineProperties(
    Object.setPrototypeOf(copied, prototype),
    descriptors,
  );
}

function wrapBeforeEach(
  beforeEach: BeforeEach,
  cleanups: Csf.CleanupCallback[],
): BeforeEach {
  const hooks = Array.isArray(beforeEach) ? beforeEach : [beforeEach];
  return hooks.map((hook) => async (context) => {
    const cleanup = await hook(context);
    if (cleanup) cleanups.push(cleanup);
  });
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
