import fs from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { RenderInput, Renderer, RenderResult } from "../renderer/types.js";

import { ComponentCollector } from "./collector.js";
import { componentInputs } from "./inputs.js";
import { serializeComponentSentinels } from "./ranges.js";
import { ComponentContext } from "./render_context.js";
import { rebaseStyleOwnership } from "./style_ownership.js";
import { insertComponentStylesheets } from "./stylesheet_links.js";
import type { ComponentDefinition } from "./types.js";

export interface ComponentRenderOutput {
  html: string;
  view: ComponentViewRecord;
}
export type ComponentGraphRenderer = (
  input: RenderInput,
  renderer: Renderer,
  definitions: readonly ComponentDefinition[],
  placement: { route: string; position: number; mockupsDir: string },
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
  const result = renderer({ ...input, node });
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
  const serialized = serializeComponentSentinels(
    serializeReviewSentinels(rendered.html),
    collector.boundaries,
  );
  const owners = new Map<string, Set<string>>();
  const linked: string[] = [];
  const renderedDefinitions = [
    ...(input.entry.kind === "component" ? [input.entry] : []),
    ...[...collector.instances.values()].map((instance) =>
      collector.definitions.get(instance.componentId)!,
    ),
  ];
  for (const definition of renderedDefinitions) {
    for (const file of definition.stylesheets) {
      if (!owners.has(file)) {
        linked.push(file);
        owners.set(file, new Set());
      }
      owners.get(file)!.add(definition.id);
    }
  }
  const physicalPaths = new Set(
    [...owners.keys()].map((file) =>
      fs.realpathSync(path.resolve(placement.mockupsDir, file)),
    ),
  );
  for (const resource of rendered.resources ?? []) {
    const candidate =
      typeof resource.path === "string"
        ? path.resolve(placement.mockupsDir, resource.path)
        : undefined;
    const physicalPath =
      candidate && fs.existsSync(candidate)
        ? fs.realpathSync(candidate)
        : undefined;
    if (
      owners.has(resource.path) ||
      (physicalPath !== undefined && physicalPaths.has(physicalPath))
    )
      invalidData(
        placement.route,
        `renderer resources record conflicts with declared stylesheet ${resource.path}`,
      );
  }
  const html = insertComponentStylesheets(
    serialized.html,
    placement.route,
    input.stylesheets,
    placement.position,
    linked,
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
      ...(rendered.resources ?? []),
      ...[...owners]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([file, ids]) => ({ path: file, componentIds: [...ids].sort() })),
    ].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  return { html, view };
};

function ComponentRoot({
  definition,
  input,
}: {
  definition: ComponentDefinition;
  input: RenderInput;
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
