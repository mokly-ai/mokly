import { isValidElement, useContext, type ReactNode } from "react";

import type { ComponentSlotRecord, ComponentRangeTarget } from "@mokly/viewer";
import {
  isCatalogueId,
  invalidData,
  slotKey,
  validateComponentSource,
} from "@mokly/viewer/data";

import { componentInputs } from "./inputs.js";
import { ComponentContext, type ComponentScope } from "./render_context.js";
import type { ComponentDefinition } from "./types.js";

interface CapturedSlot {
  record: ComponentSlotRecord;
  node: ReactNode;
  scope: ComponentScope;
}

/** The wrapper records real invocation, then gives its implementation a new owner. */
export function renderInstance(
  definition: ComponentDefinition,
  rawProps: Readonly<Record<string, unknown>>,
): ReactNode {
  const scope = useContext(ComponentContext);
  if (!scope)
    invalidData(
      definition.id,
      "registered component requires a catalogue render and an exported entry",
    );
  const descriptors = Object.getOwnPropertyDescriptors(rawProps);
  if (descriptors.key && !descriptors.key.enumerable) delete descriptors.key;
  const instanceDescriptor = descriptors.moklyInstance;
  if (instanceDescriptor && !("value" in instanceDescriptor))
    invalidData(scope.collector.label, "instance id cannot be an accessor");
  const id: unknown =
    instanceDescriptor?.value === undefined
      ? definition.id
      : instanceDescriptor.value;
  delete descriptors.moklyInstance;
  const sourceDescriptor = descriptors.__moklySource;
  if (sourceDescriptor && !("value" in sourceDescriptor))
    invalidData(scope.collector.label, "instance source cannot be an accessor");
  const source: unknown = sourceDescriptor?.value;
  delete descriptors.__moklySource;
  if (source !== undefined)
    validateComponentSource(source, `${scope.collector.label}.source`);
  if (!isCatalogueId(id))
    invalidData(scope.collector.label, "moklyInstance must be a kebab-case id");
  const input = Object.defineProperties({}, descriptors) as Record<
    string,
    unknown
  >;
  const { data, slots } = componentInputs(
    definition,
    input,
    `${scope.collector.label} / ${definition.id}`,
  );
  const instance = scope.collector.register(
    definition,
    id,
    data,
    scope,
    source,
  );
  const wrapped: Record<string, ReactNode> = {};
  for (const [name, node] of Object.entries(slots)) {
    const source =
      isValidElement<{ capture: CapturedSlot }>(node) && node.type === OwnedSlot
        ? node.props.capture
        : undefined;
    const record: ComponentSlotRecord = {
      key: slotKey(instance.key, name),
      instanceKey: instance.key,
      name,
      owner: source?.record.owner ?? scope.owner,
      ...(source ? { sourceSlotKey: source.record.key } : {}),
    };
    scope.collector.slot(record);
    const capture: CapturedSlot = {
      record,
      node: source?.node ?? node,
      scope: source?.scope ?? { ...scope, slotKey: record.key },
    };
    wrapped[name] = <OwnedSlot capture={capture} />;
  }
  const childScope: ComponentScope = {
    collector: scope.collector,
    owner: { kind: "instance", instanceKey: instance.key },
    placement: scope.placement,
  };
  const output = definition.render(
    { ...data, ...wrapped },
    scope.collector.context,
  );
  return (
    <Boundary
      scope={childScope}
      target={{ kind: "instance", instanceKey: instance.key }}
    >
      {output}
    </Boundary>
  );
}

function OwnedSlot({ capture }: { capture: CapturedSlot }): ReactNode {
  const scope = {
    ...capture.scope,
    placement: capture.scope.collector.placement(),
  };
  return (
    <Boundary
      scope={scope}
      target={{ kind: "slot", slotKey: capture.record.key }}
    >
      {capture.node}
    </Boundary>
  );
}

function Boundary({
  scope,
  target,
  children,
}: {
  scope: ComponentScope;
  target: ComponentRangeTarget;
  children: ReactNode;
}): ReactNode {
  const token = scope.collector.boundary(target);
  return (
    <>
      <template data-mokly-component-start={token} />
      <ComponentContext value={scope}>{children}</ComponentContext>
      <template data-mokly-component-end={token} />
    </>
  );
}
