import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeTarget,
  ComponentSlotRecord,
  ComponentSourceLocation,
  ComponentPropsData,
} from "@mokly/viewer";
import {
  reviewMaterialKey,
  encodeProps,
  canonicalJson,
  invalidData,
  instanceKey,
} from "@mokly/viewer/data";

import { instanceInputs } from "./instance_structure.js";
import type { ComponentDefinition, ComponentRenderContext } from "./types.js";

export interface OwnershipScope {
  owner: ComponentInputOwner;
  slotKey?: string;
  placement: number;
}

/** A collector belongs to exactly one renderer invocation, never a process registry. */
export class ComponentCollector {
  readonly instances = new Map<string, ComponentInstanceRecord>();
  readonly slots = new Map<string, ComponentSlotRecord>();
  readonly boundaries = new Map<string, ComponentRangeTarget>();
  private readonly occurrences = new Map<string, Set<number>>();
  private readonly orders = new Map<string, number>();
  private placements = 0;

  constructor(
    readonly definitions: ReadonlyMap<string, ComponentDefinition>,
    readonly context: ComponentRenderContext,
    readonly label: string,
  ) {}

  register(
    definition: ComponentDefinition,
    id: string,
    data: ComponentPropsData,
    scope: OwnershipScope,
    source?: ComponentSourceLocation,
  ): ComponentInstanceRecord {
    if (this.definitions.get(definition.id)?.render !== definition.render)
      invalidData(
        this.label,
        `component ${definition.id} is not exported in the registry`,
      );
    const key = instanceKey(scope.owner, scope.slotKey, id);
    const orderScope = canonicalJson([
      scope.owner,
      scope.slotKey ?? null,
      scope.placement,
    ]);
    const order = this.orders.get(orderScope) ?? 0;
    this.orders.set(orderScope, order + 1);
    const instance: ComponentInstanceRecord = {
      key,
      id,
      componentId: definition.id,
      owner: scope.owner,
      ...(scope.slotKey ? { slotKey: scope.slotKey } : {}),
      order,
      props: encodeProps(data),
      propsKey: reviewMaterialKey(data),
      ...(source ? { source: { ...source } } : {}),
    };
    const previous = this.instances.get(key);
    const placements = this.occurrences.get(key) ?? new Set<number>();
    if (previous && placements.has(scope.placement))
      invalidData(
        this.label,
        `duplicate component instance ${id}; repeated invocations need distinct moklyInstance ids`,
      );
    if (
      previous &&
      canonicalJson(instanceInputs(previous)) !==
        canonicalJson(instanceInputs(instance))
    )
      invalidData(
        this.label,
        `conflicting inputs for replayed component ${id}; captured slot content must be deterministic`,
      );
    placements.add(scope.placement);
    this.occurrences.set(key, placements);
    this.instances.set(key, previous ?? instance);
    return previous ?? instance;
  }

  slot(record: ComponentSlotRecord): void {
    const previous = this.slots.get(record.key);
    if (previous && canonicalJson(previous) !== canonicalJson(record))
      invalidData(this.label, "conflicting forwarded slot ownership");
    this.slots.set(record.key, record);
  }

  boundary(target: ComponentRangeTarget): string {
    const token = `b-${this.boundaries.size}`;
    this.boundaries.set(token, target);
    return token;
  }

  placement(): number {
    return ++this.placements;
  }
}
