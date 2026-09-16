import type { ObjectPropSchema } from "@mokly/viewer";
import {
  isCatalogueId,
  validateControlledValues,
  validateControls,
  invalidData,
  plainKeys,
  validatePropSchema,
} from "@mokly/viewer/data";

import { componentInputs } from "./inputs.js";
import type {
  ComponentDefinition,
  ComponentInput,
  RegisteredComponent,
} from "./types.js";
import { renderInstance } from "./wrapper.js";
import { registerComponentWrapper } from "./wrapper_identity.js";

/** Register one typed component with saved variants and an instrumented JSX wrapper. */
export function defineComponent<
  const S extends ObjectPropSchema,
  const Slots extends readonly string[] = readonly [],
>(input: ComponentInput<S, Slots>): RegisteredComponent<S, Slots> {
  const definition = validateComponentDefinition(input);
  const Component = (props: Readonly<Record<string, unknown>>) =>
    renderInstance(definition, props);
  registerComponentWrapper(Component);
  return { entry: definition, Component } as unknown as RegisteredComponent<
    S,
    Slots
  >;
}

/** Validate and snapshot a definition at both authoring and registry boundaries. */
export function validateComponentDefinition(
  input: unknown,
): ComponentDefinition {
  plainKeys(input, "Component");
  const value = input as ComponentDefinition;
  const at = `Component ${String(value.id)}`;
  if (!isCatalogueId(value.id)) invalidData(at, "id must be kebab-case");
  validatePropSchema(value.propSchema, at);
  if (value.propSchema.kind !== "object")
    invalidData(at, "propSchema must be an object schema");
  if (typeof value.render !== "function")
    invalidData(at, "render must be a function");
  const slots = value.slots ?? [];
  if (
    !Array.isArray(slots) ||
    !slots.every((name) => typeof name === "string" && name.length > 0) ||
    new Set(slots).size !== slots.length
  )
    invalidData(at, "slots must have unique nonempty names");
  for (const key of [...Object.keys(value.propSchema.properties), ...slots]) {
    if (
      [
        "moklyInstance",
        "__moklySource",
        "key",
        "ref",
        "__proto__",
        "constructor",
        "prototype",
      ].includes(key)
    )
      invalidData(at, `reserved prop ${key}`);
    if (slots.includes(key) && Object.hasOwn(value.propSchema.properties, key))
      invalidData(at, `slot ${key} overlaps a data prop`);
  }
  const controls = value.controls ?? {};
  validateControls(value.propSchema, controls, at);
  const owned = value.ownedDependencies ?? [];
  if (
    !Array.isArray(owned) ||
    !owned.every(
      (dependency) =>
        typeof dependency === "string" &&
        value.dependencies?.includes(dependency),
    )
  )
    invalidData(at, "ownedDependencies must be a subset of dependencies");
  const definition: ComponentDefinition = {
    ...value,
    __viaDefine: true,
    kind: "component",
    propSchema: structuredClone(value.propSchema),
    controls: structuredClone(controls),
    slots: [...slots].sort(),
    ownedDependencies: [...new Set(owned)].sort(),
  };
  if (!Array.isArray(value.variants) || !value.variants.length)
    invalidData(at, "at least one saved variant is required");
  const ids = new Set<string>();
  definition.variants = value.variants.map((variant) => {
    for (const key of plainKeys(variant, at))
      if (!["id", "title", "description", "props"].includes(key))
        invalidData(at, `unknown variant field ${key}`);
    if (!isCatalogueId(variant.id) || ids.has(variant.id))
      invalidData(at, "variant ids must be unique kebab-case strings");
    if (
      typeof variant.title !== "string" ||
      !variant.title.trim() ||
      (variant.description !== undefined &&
        (typeof variant.description !== "string" ||
          !variant.description.trim()))
    )
      invalidData(
        at,
        "variant requires nonempty title and optional description",
      );
    ids.add(variant.id);
    const inputs = componentInputs(
      definition,
      variant.props,
      `${at} / ${variant.id}`,
    );
    validateControlledValues(
      definition.controls,
      inputs.data,
      `${at} / ${variant.id}`,
    );
    return { ...variant, props: { ...inputs.data, ...inputs.slots } };
  });
  return definition;
}
