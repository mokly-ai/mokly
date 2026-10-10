import fs from "node:fs";
import path from "node:path";

import type { ReactNode } from "react";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { definitionPath } from "../authoring/identity.js";
import type { BuildDiagnostic } from "../build/build_warnings.js";
import { rendererDocument } from "../renderer/result.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { RenderInput, Renderer } from "../renderer/types.js";

import { Boundary } from "./boundary.js";
import { ComponentCollector } from "./collector.js";
import { componentInputs } from "./inputs.js";
import { serializeComponentSentinels } from "./ranges.js";
import { ComponentContext } from "./render_context.js";
import { insertComponentStylesheets } from "./stylesheet_links.js";
import { rendererStylesheetPaths } from "./stylesheet_reuse.js";
import type {
  ComponentDefinition,
  ComponentVariantDefinition,
} from "./types.js";

export interface LinkedComponentStylesheet {
  physical: string;
  componentPaths: readonly string[];
}

export interface ComponentRenderOutput {
  html: string;
  view: ComponentViewRecord;
  stylesheetLinks: readonly LinkedComponentStylesheet[];
  diagnostics?: readonly BuildDiagnostic[];
}
export type ComponentGraphRenderer = (
  input: RenderInput,
  renderer: Renderer,
  definitions: readonly ComponentDefinition[],
  placement: {
    route: string;
    diagnosticRoute?: string;
    position: number;
    configuredHrefs: readonly string[];
    mockupsDir: string;
    onWarning?: (warning: BuildDiagnostic) => void;
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
    new Map(definitions.map((entry) => [definitionPath(entry), entry])),
    input,
    `${input.entry.path} / ${input.viewport} / ${input.colorScheme}`,
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
              (definition) =>
                definitionPath(definition) === input.entry.variantOf,
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
  const rendered = rendererDocument(result, input);
  if (!/<html[\s>]/i.test(rendered))
    invalidData(
      collector.label,
      "renderer must return a complete HTML document",
    );
  const serialized = serializeComponentSentinels(
    serializeReviewSentinels(rendered),
    collector.boundaries,
  );
  const declarations = new Map<string, { file: string; paths: Set<string> }>();
  const renderedDefinitions = [
    ...(input.entry.kind === "component"
      ? [
          definitions.find(
            (entry) => definitionPath(entry) === input.entry.variantOf,
          )!,
        ]
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
        declarations.set(physical, { file, paths: new Set() });
      declarations.get(physical)!.paths.add(definitionPath(definition));
    }
  }
  const physicalPaths = new Set(declarations.keys());
  const warnings: BuildDiagnostic[] = [];
  const rendererLinks = rendererStylesheetPaths(
    serialized.html,
    placement.route,
    placement.mockupsDir,
    physicalPaths,
    placement.configuredHrefs,
  );
  const html = insertComponentStylesheets(
    serialized.html,
    placement.route,
    placement.configuredHrefs,
    placement.position,
    [...declarations]
      .filter(([physical]) => !rendererLinks.has(physical))
      .map(([, declaration]) => declaration.file),
    (warning) => {
      warnings.push(warning);
      placement.onWarning?.(warning);
    },
    placement.diagnosticRoute,
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
    resources:
      typeof result === "string"
        ? []
        : [...(result.resources ?? [])].sort((left, right) =>
            left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
          ),
  };
  return {
    html,
    view,
    stylesheetLinks: [...declarations]
      .filter(([physical]) => !rendererLinks.has(physical))
      .map(([physical, { paths }]) => ({
        physical,
        componentPaths: [...paths].sort(),
      })),
    ...(warnings.length ? { diagnostics: warnings } : {}),
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
  if (!definition)
    invalidData(entry.path ?? "<unresolved>", "unknown component parent");
  const { data, slots } = componentInputs(
    definition,
    entry.props,
    `${definitionPath(definition)} / ${entry.path}`,
  );
  return definition.render(
    { ...(input.componentProps ?? data), ...slots },
    input,
  );
}
