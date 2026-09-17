import { reviewMaterialKey } from "../data/material_key.js";
import { isCatalogueId } from "../navigation/logical.js";

import { decodeProps, encodeProps } from "./codec.js";
import { canonicalJson, exactKeys, invalidData } from "./data.js";
import { instanceKey, isComponentKey, slotKey } from "./keys.js";
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentViewRecord,
  ManifestComponent,
} from "./manifest_types.js";
import { validateProps } from "./props.js";
import { validateComponentSource } from "./source.js";
import { sortedStrings, validateResourcePath } from "./validation_helpers.js";
import { validateViewReferences } from "./view_references.js";

export function validateComponentViews(
  value: unknown,
  dark: boolean,
  components: ReadonlyMap<
    string,
    Pick<ManifestComponent, "propSchema" | "slots">
  >,
  at: string,
  rootId?: string,
): asserts value is readonly ComponentViewRecord[] {
  const axes = ["mobile", "desktop"].flatMap((viewport) =>
    (dark ? ["light", "dark"] : ["light"]).map(
      (scheme) => `${viewport}/${scheme}`,
    ),
  );
  if (!Array.isArray(value) || value.length !== axes.length)
    invalidData(at, "componentViews must record every available view");
  value.forEach((view, i) => {
    exactKeys(
      view,
      [
        "viewport",
        "colorScheme",
        "instances",
        "slots",
        "ranges",
        "styles",
        "resources",
      ],
      at,
    );
    if (`${String(view.viewport)}/${String(view.colorScheme)}` !== axes[i])
      invalidData(at, "view axes must be unique and ordered");
    for (const field of ["instances", "slots", "ranges", "styles", "resources"])
      if (!Array.isArray(view[field]))
        invalidData(at, `missing ${field} array`);
    validateComponentViewRecord(
      view as unknown as ComponentViewRecord,
      components,
      `${at} / ${axes[i]}`,
      rootId,
    );
  });
}

/** Validate one actual render without asserting completeness of other views. */
export function validateComponentViewRecord(
  view: ComponentViewRecord,
  components: ReadonlyMap<
    string,
    Pick<ManifestComponent, "propSchema" | "slots">
  >,
  at: string,
  rootId?: string,
  historical = false,
): void {
  for (const instance of view.instances) {
    exactKeys(
      instance,
      [
        "key",
        "id",
        "componentId",
        "owner",
        "slotKey",
        "order",
        "props",
        "propsKey",
        "source",
      ],
      at,
    );
    if (instance.source !== undefined)
      validateComponentSource(instance.source, `${at}.source`);
    if (
      !isComponentKey(instance.key) ||
      !isCatalogueId(instance.id) ||
      !isCatalogueId(instance.componentId)
    )
      invalidData(at, "invalid component instance identity");
    validateOwner(instance.owner, at);
    if (instance.slotKey !== undefined && !isComponentKey(instance.slotKey))
      invalidData(at, "invalid instance slot key");
    if (
      instance.key !==
      instanceKey(instance.owner, instance.slotKey, instance.id)
    )
      invalidData(at, "instance key mismatch");
    if (!Number.isSafeInteger(instance.order) || instance.order < 0)
      invalidData(at, "invalid instance order");
    const component = components.get(instance.componentId);
    if (!component) invalidData(at, "instance names an unknown component");
    const props = historical
      ? decodeProps(instance.props)
      : validateProps(
          component.propSchema,
          decodeProps(instance.props),
          `${at} / ${instance.id}`,
        );
    if (
      canonicalJson(encodeProps(props)) !== canonicalJson(instance.props) ||
      reviewMaterialKey(props) !== instance.propsKey
    )
      invalidData(at, "props key or canonical encoding mismatch");
  }
  sortedStrings(
    view.instances.map((instance) => instance.key),
    `${at}.instances`,
  );
  for (const slot of view.slots) {
    exactKeys(
      slot,
      ["key", "instanceKey", "name", "owner", "sourceSlotKey"],
      at,
    );
    if (
      !isComponentKey(slot.key) ||
      !isComponentKey(slot.instanceKey) ||
      typeof slot.name !== "string" ||
      slot.key !== slotKey(slot.instanceKey, slot.name)
    )
      invalidData(at, "invalid slot identity");
    validateOwner(slot.owner, at);
    if (slot.sourceSlotKey !== undefined && !isComponentKey(slot.sourceSlotKey))
      invalidData(at, "invalid forwarded slot key");
  }
  sortedStrings(
    view.slots.map((slot) => slot.key),
    `${at}.slots`,
  );
  const instances = new Map(view.instances.map((item) => [item.key, item]));
  const slots = new Map(view.slots.map((item) => [item.key, item]));
  validateOrders(view.instances, at);
  validateViewReferences(view, components, instances, slots, at, historical);
  const rendered = new Set([
    ...view.instances.map((instance) => instance.componentId),
    ...(rootId ? [rootId] : []),
  ]);
  let end = 0;
  for (const style of view.styles) {
    exactKeys(style, ["startOffset", "endOffset", "componentIds"], at);
    if (
      !Number.isSafeInteger(style.startOffset) ||
      !Number.isSafeInteger(style.endOffset) ||
      style.startOffset < end ||
      style.endOffset <= style.startOffset
    )
      invalidData(at, "invalid or overlapping style range");
    end = style.endOffset;
    validateOwners(style.componentIds, rendered, at);
  }
  for (const resource of view.resources) {
    exactKeys(resource, ["path", "componentIds"], at);
    validateResourcePath(resource.path, at);
    validateOwners(resource.componentIds, rendered, at);
  }
  sortedStrings(
    view.resources.map((resource) => resource.path),
    `${at}.resources`,
  );
}

function validateOwner(
  owner: unknown,
  at: string,
): asserts owner is ComponentInputOwner {
  exactKeys(owner, ["kind", "instanceKey"], at);
  if (owner.kind === "entry" && !Object.hasOwn(owner, "instanceKey")) return;
  if (owner.kind === "instance" && isComponentKey(owner.instanceKey)) return;
  invalidData(at, "invalid input owner");
}

function validateOrders(
  instances: readonly ComponentInstanceRecord[],
  at: string,
): void {
  const groups = new Map<string, number[]>();
  for (const instance of instances) {
    const key = canonicalJson([instance.owner, instance.slotKey ?? null]);
    const group = groups.get(key) ?? [];
    group.push(instance.order);
    groups.set(key, group);
  }
  for (const group of groups.values())
    if (group.sort((a, b) => a - b).some((value, i) => value !== i))
      invalidData(
        at,
        "instance order must be contiguous and unique within each owner/slot scope",
      );
}

function validateOwners(
  value: unknown,
  rendered: ReadonlySet<string>,
  at: string,
): void {
  sortedStrings(value, at);
  if (!value.length || !value.every((id) => rendered.has(id)))
    invalidData(at, "style/resource owners must render in this view");
}
