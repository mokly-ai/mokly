import type { ObjectPropSchema } from "@mokly/viewer";
import {
  isEntryId,
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
  ComponentVariant,
  ComponentVariantDefinition,
  RegisteredComponent,
} from "./types.js";
import { renderInstance } from "./wrapper.js";
import { registerComponentWrapper } from "./wrapper_identity.js";

/** Register one typed component with saved variants and an instrumented JSX wrapper. */
export function defineComponent<
  const S extends ObjectPropSchema,
  const Slots extends readonly string[] = readonly [],
>(input: ComponentInput<S, Slots>): RegisteredComponent<S, Slots> {
  plainKeys(input, "Component");
  const value = input as ComponentInput<S, Slots>;
  if (!Array.isArray(value.variants) || !value.variants.length) {
    invalidData(
      `Component ${String(value.id)}`,
      "at least one saved variant is required",
    );
  }
  const { variants, ...parentInput } = value;
  const definition = validateComponentDefinition(parentInput);
  const entries = [
    definition,
    ...variants.map((variant) =>
      componentVariantDefinition(definition, variant),
    ),
  ] as const;
  const Component = (props: Readonly<Record<string, unknown>>) =>
    renderInstance(definition, props);
  registerComponentWrapper(Component);
  return { entries, Component } as unknown as RegisteredComponent<S, Slots>;
}

/** Validate and snapshot a definition at both authoring and registry boundaries. */
export function validateComponentDefinition(
  input: unknown,
): ComponentDefinition {
  plainKeys(input, "Component");
  const value = input as ComponentDefinition;
  const at = `Component ${String(value.id)}`;
  if (!isEntryId(value.id))
    invalidData(at, "id must be globally unique kebab-case");
  validatePropSchema(value.propSchema, at);
  if (value.propSchema.kind !== "object")
    invalidData(at, "propSchema must be an object schema");
  if (typeof value.render !== "function")
    invalidData(at, "render must be a function");
  if ("interactive" in value && value.interactive !== false)
    invalidData(at, "interactive must be false when supplied");
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
    navPath: value.navPath === undefined ? [] : value.navPath,
    __viaDefine: true,
    kind: "component",
    propSchema: structuredClone(value.propSchema),
    controls: structuredClone(controls),
    slots: [...slots].sort(),
    ownedDependencies: [...new Set(owned)].sort(),
  };
  return definition;
}

/** Validate one flattened component variant against its registered parent. */
export function validateComponentVariantDefinition(
  input: ComponentVariantDefinition,
  parent: ComponentDefinition,
): ComponentVariantDefinition {
  const at = `Component ${parent.id} / ${String(input.id)}`;
  if (!isEntryId(input.id))
    invalidData(at, "variant id must be globally unique kebab-case");
  if (input.variantOf !== parent.id)
    invalidData(at, "variantOf must name its component parent");
  const values = componentInputs(parent, input.props, at);
  validateControlledValues(parent.controls, values.data, at);
  const suppliedSlots = Object.keys(values.slots).sort();
  if (JSON.stringify(input.suppliedSlots) !== JSON.stringify(suppliedSlots))
    invalidData(at, "suppliedSlots must match the supplied slot props");
  return {
    ...input,
    props: { ...values.data, ...values.slots },
    suppliedSlots,
  };
}

function componentVariantDefinition(
  parent: ComponentDefinition,
  variant: ComponentVariant<Readonly<Record<string, unknown>>>,
): ComponentVariantDefinition {
  const at = `Component ${parent.id}`;
  for (const key of plainKeys(variant, at))
    if (!["id", "title", "description", "props"].includes(key))
      invalidData(at, `unknown variant field ${key}`);
  if (!isEntryId(variant.id))
    invalidData(at, "variant id must be globally unique kebab-case");
  if (
    typeof variant.title !== "string" ||
    !variant.title.trim() ||
    (variant.description !== undefined &&
      (typeof variant.description !== "string" || !variant.description.trim()))
  )
    invalidData(at, "variant requires nonempty title and optional description");
  const values = componentInputs(
    parent,
    variant.props,
    `${at} / ${variant.id}`,
  );
  validateControlledValues(
    parent.controls,
    values.data,
    `${at} / ${variant.id}`,
  );
  const definition: ComponentVariantDefinition = {
    __viaDefine: true,
    ...(parent.colorSchemes ? { colorSchemes: [...parent.colorSchemes] } : {}),
    dependencies: [...parent.dependencies],
    description: variant.description ?? parent.description,
    id: variant.id,
    ...(parent.interactive !== undefined
      ? { interactive: parent.interactive }
      : {}),
    kind: "component",
    navPath: Array.isArray(parent.navPath)
      ? [...parent.navPath]
      : parent.navPath,
    props: { ...values.data, ...values.slots },
    relatedDocs: [...parent.relatedDocs],
    suppliedSlots: Object.keys(values.slots).sort(),
    ...(parent.tags ? { tags: [...parent.tags] } : {}),
    title: variant.title,
    variantOf: parent.id,
  };
  if (parent.definedIn !== undefined) definition.definedIn = parent.definedIn;
  return definition;
}
