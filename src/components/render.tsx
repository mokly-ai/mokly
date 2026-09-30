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
    new Map(definitions.map((entry) => [entry.id, entry])),
    input,
    `${input.entry.id} / ${input.viewport} / ${input.colorScheme}`,
  );
  const node = (
    <ComponentContext
      value={{ collector, owner: { kind: "entry" }, placement: 0 }}
    >
      {input.entry.kind === "component" ? (
        <ComponentRoot
          definition={definitions.find(
            (definition) => definition.id === input.entry.variantOf,
          )}
          entry={input.entry}
          input={input}
        />
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
    styles: rebaseStyleOwnership(
      rendered.html,
      serialized.html,
      rendered.styles ?? [],
    ),
    resources: rendered.resources ?? [],
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
