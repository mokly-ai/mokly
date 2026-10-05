import { isValidElement, useContext, type ReactNode } from "react";

import type { ComponentSlotRecord, ComponentRangeTarget } from "@mokly/viewer";
import {
  isKebabCase,
  isPathSegment,
  invalidData,
  slotKey,
  validateComponentSource,
} from "@mokly/viewer/data";

import { definitionPath, definitionSlug } from "../authoring/identity.js";

import { componentInputs } from "./inputs.js";
import {
  ComponentContext,
  type StaticComponentScope,
} from "./render_context.js";
import type { ComponentDefinition } from "./types.js";

interface CapturedSlot {
  record: ComponentSlotRecord;
  node: ReactNode;
  scope: StaticComponentScope;
}

/** The wrapper records real invocation, then gives its implementation a new owner. */
export function renderInstance(
  definition: ComponentDefinition,
  rawProps: Readonly<Record<string, unknown>>,
): ReactNode {
  const scope = useContext(ComponentContext);
  if (!scope)
    invalidData(
      definitionPath(definition),
      "registered component requires a catalogue render and an exported entry",
    );
  const label =
    scope.kind === "static"
      ? scope.collector.label
      : `${definitionPath(definition)} / Live`;
  const descriptors = Object.getOwnPropertyDescriptors(rawProps);
  if (descriptors.key && !descriptors.key.enumerable) delete descriptors.key;
  const instanceDescriptor = descriptors.moklyInstance;
  if (instanceDescriptor && !("value" in instanceDescriptor))
    invalidData(label, "instance id cannot be an accessor");
  const id: unknown =
    instanceDescriptor?.value === undefined
      ? definitionSlug(definition)
      : instanceDescriptor.value;
  delete descriptors.moklyInstance;
  const sourceDescriptor = descriptors.__moklySource;
  if (sourceDescriptor && !("value" in sourceDescriptor))
    invalidData(label, "instance source cannot be an accessor");
  const source: unknown = sourceDescriptor?.value;
  delete descriptors.__moklySource;
  if (source !== undefined) validateComponentSource(source, `${label}.source`);
  if (
    typeof id !== "string" ||
    (instanceDescriptor?.value === undefined
      ? !isPathSegment(id)
      : !isKebabCase(id))
  )
    invalidData(label, "moklyInstance must be a kebab-case id");
  const input = Object.defineProperties({}, descriptors) as Record<
    string,
    unknown
  >;
  const { data, slots } = componentInputs(
    definition,
    input,
    `${label} / ${definitionPath(definition)}`,
  );
  if (scope.kind === "interactive")
    return definition.render({ ...data, ...slots }, scope.context);
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
  const childScope: StaticComponentScope = {
    collector: scope.collector,
    kind: "static",
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
  scope: StaticComponentScope;
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
