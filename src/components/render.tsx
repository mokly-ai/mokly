import type { ReactNode } from "react";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { definitionPath } from "../authoring/identity.js";
import { rendererDocument } from "../renderer/result.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";
import type { RenderInput, Renderer } from "../renderer/types.js";

import { ComponentCollector } from "./collector.js";
import { componentInputs } from "./inputs.js";
import { serializeComponentSentinels } from "./ranges.js";
import { ComponentContext } from "./render_context.js";
import type {
  ComponentDefinition,
  ComponentVariantDefinition,
} from "./types.js";

export interface ComponentRenderOutput {
  html: string;
  view: ComponentViewRecord;
}
export type ComponentGraphRenderer = (
  input: RenderInput,
  renderer: Renderer,
  definitions: readonly ComponentDefinition[],
) => ComponentRenderOutput;

/** This entrypoint is bundled with the consumer, sharing its one React context. */
export const renderWithComponents: ComponentGraphRenderer = (
  input,
  renderer,
  definitions,
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
        <ComponentRoot
          definition={definitions.find(
            (definition) =>
              definitionPath(definition) === input.entry.variantOf,
          )}
          entry={input.entry}
          input={input}
        />
      ) : (
        input.node
      )}
    </ComponentContext>
  );
  const rendered = rendererDocument(renderer({ ...input, node }), input);
  if (!/<html[\s>]/i.test(rendered))
    invalidData(
      collector.label,
      "renderer must return a complete HTML document",
    );
  const serialized = serializeComponentSentinels(
    serializeReviewSentinels(rendered),
    collector.boundaries,
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
  };
  return { html: serialized.html, view };
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
