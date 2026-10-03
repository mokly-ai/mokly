import fs from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import type { BuildWarning } from "../build/warnings.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { RenderInput, Renderer, RenderResult } from "../renderer/types.js";

import { Boundary } from "./boundary.js";
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
import type {
  ComponentDefinition,
  ComponentVariantDefinition,
} from "./types.js";

export interface LinkedComponentStylesheet {
  physical: string;
  componentIds: readonly string[];
}

export interface ComponentRenderOutput {
  html: string;
  view: ComponentViewRecord;
  stylesheetLinks: readonly LinkedComponentStylesheet[];
  warnings?: readonly BuildWarning[];
}
export type ComponentGraphRenderer = (
  input: RenderInput,
  renderer: Renderer,
  definitions: readonly ComponentDefinition[],
  placement: {
    route: string;
    position: number;
    mockupsDir: string;
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
    `${input.entry.id} / ${input.viewport} / ${input.colorScheme}`,
  );
  const node = (
    <ComponentContext
      value={{ collector, owner: { kind: "entry" }, placement: 0 }}
    >
      {input.entry.kind === "component" ? (
        <Boundary
          scope={{ collector, owner: { kind: "entry" }, placement: 0 }}
          target={{ kind: "root" }}
        >
          <ComponentRoot
            definition={definitions.find(
              (definition) => definition.id === input.entry.variantOf,
            )}
            entry={input.entry}
            input={input}
          />
        </Boundary>
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
  assertNoAuthoredStylesheetToken(rendered.html, placement.route);
  const serialized = serializeComponentSentinels(
    serializeReviewSentinels(rendered.html),
    collector.boundaries,
  );
  const declarations = new Map<string, { file: string; ids: Set<string> }>();
  const renderedDefinitions = [
    ...(input.entry.kind === "component"
      ? [definitions.find((entry) => entry.id === input.entry.variantOf)!]
      : []),
    ...[...collector.instances.values()].map((instance) =>
      collector.definitions.get(instance.componentId)!,
    ),
  ];
  for (const definition of renderedDefinitions) {
    for (const file of definition.stylesheets) {
      const physical = fs.realpathSync(
        path.resolve(placement.mockupsDir, file),
      );
      if (!declarations.has(physical))
        declarations.set(physical, { file, ids: new Set() });
      declarations.get(physical)!.ids.add(definition.id);
    }
  }
  const physicalPaths = new Set(declarations.keys());
  const warnings: BuildWarning[] = [];
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
    [...declarations]
      .filter(([physical]) => !rendererLinks.has(physical))
      .map(([, declaration]) => declaration.file),
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
    resources: [...(rendered.resources ?? [])].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  return {
    html,
    view,
    stylesheetLinks: [...declarations].map(([physical, { ids }]) => ({
      physical,
      componentIds: [...ids].sort(),
    })),
    ...(warnings.length ? { warnings } : {}),
  };
};

function ComponentRoot({
  definition,
  entry,
  input,
}: {
  definition: ComponentDefinition | undefined;
  entry: ComponentVariantDefinition;
  input: RenderInput;
}): ReactNode {
  if (!definition) invalidData(entry.id, "unknown component parent");
  const { data, slots } = componentInputs(
    definition,
    entry.props,
    `${definition.id} / ${entry.id}`,
  );
  return definition.render(
    { ...(input.componentProps ?? data), ...slots },
    input,
  );
}
