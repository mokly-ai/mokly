import fs from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData, validateResourcePath } from "@mokly/viewer/data";

import type { ScreenDefinition } from "../authoring/types.js";
import type { BuildWarning } from "../build/warnings.js";
import { ignoredDeclaredResourceOwner } from "../build/warnings.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { RenderInput, Renderer, RenderResult } from "../renderer/types.js";

import { ComponentCollector } from "./collector.js";
import { componentInputs } from "./inputs.js";
import { serializeComponentSentinels } from "./ranges.js";
import { ComponentContext } from "./render_context.js";
import { rebaseStyleOwnership } from "./style_ownership.js";
import {
  assertNoAuthoredStylesheetToken,
  insertComponentStylesheets,
} from "./stylesheet_links.js";
import { rendererStylesheetPaths } from "./stylesheet_reuse.js";
import type { ComponentDefinition } from "./types.js";

export interface ComponentRenderOutput {
  html: string;
  view: ComponentViewRecord;
  warnings?: readonly BuildWarning[];
}
export type ComponentGraphRenderer = (
  input: Omit<RenderInput, "entry"> & {
    entry: ScreenDefinition | ComponentDefinition;
  },
  renderer: Renderer,
  definitions: readonly ComponentDefinition[],
  placement: {
    route: string;
    position: number;
    mockupsDir: string;
    isPublicFile: (candidate: string) => boolean;
  },
) => ComponentRenderOutput;

/** This entrypoint is bundled with the consumer, sharing its one React context. */
export const renderWithComponents: ComponentGraphRenderer = (
  input,
  renderer,
  definitions,
  placement,
) => {
  const collector = new ComponentCollector(
    new Map(definitions.map((entry) => [entry.id, entry])),
    input,
    `${input.entry.id} / ${input.variantId ?? "screen"} / ${input.viewport} / ${input.colorScheme}`,
  );
  const node = (
    <ComponentContext
      value={{ collector, owner: { kind: "entry" }, placement: 0 }}
    >
      {input.entry.kind === "component" ? (
        <ComponentRoot definition={input.entry} input={input} />
      ) : (
        input.node
      )}
    </ComponentContext>
  );
  const rendererEntry =
    input.entry.kind === "component"
      ? (({ stylesheets: _stylesheets, ...entry }) => entry)(input.entry)
      : input.entry;
  const result = renderer({ ...input, entry: rendererEntry, node });
  const rendered: RenderResult =
    typeof result === "string" ? { html: result } : result;
  if (
    !rendered ||
    typeof rendered.html !== "string" ||
    !/<html[\s>]/i.test(rendered.html)
  )
    invalidData(
      collector.label,
      "renderer must return a complete HTML document",
    );
  assertNoAuthoredStylesheetToken(rendered.html, placement.route);
  const serialized = serializeComponentSentinels(
    serializeReviewSentinels(rendered.html),
    collector.boundaries,
  );
  const owners = new Map<string, { file: string; ids: Set<string> }>();
  const renderedDefinitions = [
    ...(input.entry.kind === "component" ? [input.entry] : []),
    ...[...collector.instances.values()].map((instance) =>
      collector.definitions.get(instance.componentId)!,
    ),
  ];
  for (const definition of renderedDefinitions) {
    for (const file of definition.stylesheets) {
      const physical = fs.realpathSync(
        path.resolve(placement.mockupsDir, file),
      );
      if (!owners.has(physical)) owners.set(physical, { file, ids: new Set() });
      owners.get(physical)!.ids.add(definition.id);
    }
  }
  const physicalPaths = new Set(owners.keys());
  const allDeclared = new Set(
    definitions.flatMap((definition) =>
      definition.stylesheets.map((file) =>
        fs.realpathSync(path.resolve(placement.mockupsDir, file)),
      ),
    ),
  );
  const warnings: BuildWarning[] = [];
  const warned = new Set<string>();
  const retainedResources = (rendered.resources ?? []).filter((resource) => {
    validateResourcePath(resource.path, placement.route);
    const candidate = path.resolve(placement.mockupsDir, resource.path);
    const physicalPath = fs.existsSync(candidate)
      ? fs.realpathSync(candidate)
      : undefined;
    if (physicalPath === undefined || !allDeclared.has(physicalPath))
      return true;
    if (!placement.isPublicFile(candidate))
      invalidData(
        placement.route,
        `renderer resource is not a public file: ${resource.path}`,
      );
    if (!warned.has(physicalPath)) {
      warned.add(physicalPath);
      warnings.push(
        ignoredDeclaredResourceOwner(
          placement.route,
          physicalPath,
          resource.path,
        ),
      );
    }
    return false;
  });
  const rendererLinks = rendererStylesheetPaths(
    serialized.html,
    placement.route,
    placement.mockupsDir,
    physicalPaths,
    input.stylesheets,
  );
  const html = insertComponentStylesheets(
    serialized.html,
    placement.route,
    input.stylesheets,
    placement.position,
    [...owners]
      .filter(([physical]) => !rendererLinks.has(physical))
      .map(([, owner]) => owner.file),
    true,
    (warning) => warnings.push(warning),
  );
  const view: ComponentViewRecord = {
    viewport: input.viewport,
    colorScheme: input.colorScheme,
    instances: [...collector.instances.values()].sort((a, b) =>
      a.key < b.key ? -1 : 1,
    ),
    slots: [...collector.slots.values()].sort((a, b) =>
      a.key < b.key ? -1 : 1,
    ),
    ranges: serialized.ranges,
    styles: rebaseStyleOwnership(rendered.html, html, rendered.styles ?? []),
    resources: [
      ...retainedResources,
      ...[...owners].map(([physical, { file, ids }]) => ({
        path: rendererLinks.get(physical) ?? file,
        componentIds: [...ids].sort(),
      })),
    ].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  return { html, view, ...(warnings.length ? { warnings } : {}) };
};

function ComponentRoot({
  definition,
  input,
}: {
  definition: ComponentDefinition;
  input: Omit<RenderInput, "entry"> & {
    entry: ScreenDefinition | ComponentDefinition;
  };
}): ReactNode {
  const variant = definition.variants.find(
    (variant) => variant.id === input.variantId,
  );
  if (!variant) invalidData(definition.id, "unknown saved variant");
  const { data, slots } = componentInputs(
    definition,
    input.componentProps ?? variant.props,
    `${definition.id} / ${variant.id}`,
  );
  return definition.render({ ...data, ...slots }, input);
}
