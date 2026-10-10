import type { ObjectPropSchema } from "@mokly/viewer";
import {
  validateControlledValues,
  validateControls,
  invalidData,
  plainKeys,
  validatePropSchema,
} from "@mokly/viewer/data";

import { branded } from "../authoring/definitions.js";
import { unknownFields, authoredInput } from "../authoring/fields.js";
import {
  COMPONENT_REGISTRATION,
  VARIANT_PARENT,
  VARIANT_INDEX,
  DEFINITION,
  DEFINITION_IDENTITY,
  UNKNOWN_FIELDS,
} from "../authoring/markers.js";

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
  const value = authoredInput(input, "component");
  if (!Array.isArray(value.variants) || !value.variants.length) {
    invalidData(
      value.path === undefined ? "Component" : `Component ${value.path}`,
      "at least one saved variant is required",
    );
  }
  const { variants, ...parentInput } = value;
  const definition = validateComponentDefinition(parentInput);
  Object.assign(definition, unknownFields(input, "component"));
  const entries = [
    definition,
    ...variants.map((variant, index) =>
      componentVariantDefinition(definition, variant, index),
    ),
  ] as const;
  const Component = (props: Readonly<Record<string, unknown>>) =>
    renderInstance(definition, props);
  registerComponentWrapper(Component);
  return {
    entries,
    Component,
    [COMPONENT_REGISTRATION]: true,
  } as unknown as RegisteredComponent<S, Slots>;
}

/** Validate and snapshot a definition at both authoring and registry boundaries. */
export function validateComponentDefinition(
  input: unknown,
): ComponentDefinition {
  const descriptors =
    input !== null && typeof input === "object"
      ? Object.getOwnPropertyDescriptors(input)
      : undefined;
  if (descriptors) {
    for (const marker of [DEFINITION, DEFINITION_IDENTITY, UNKNOWN_FIELDS])
      Reflect.deleteProperty(descriptors, marker);
    plainKeys(
      Object.create(Object.getPrototypeOf(input), descriptors),
      "Component",
    );
  } else plainKeys(input, "Component");
  const value = input as ComponentDefinition;
  const at = value.path === undefined ? "Component" : `Component ${value.path}`;
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
  const stylesheets: unknown = value.stylesheets ?? [];
  if (!Array.isArray(stylesheets))
    invalidData(at, "stylesheets must be an array");
  const declared = stylesheets as unknown[];
  for (const stylesheet of declared) {
    if (
      typeof stylesheet !== "string" ||
      !stylesheet ||
      stylesheet.startsWith("/") ||
      stylesheet.includes("\\") ||
      stylesheet.includes("?") ||
      stylesheet.includes("#") ||
      /^[A-Za-z][\w+.-]*:/.test(stylesheet) ||
      stylesheet
        .split("/")
        .some((segment) => !segment || segment === "." || segment === "..") ||
      !/\.css$/i.test(stylesheet)
    )
      invalidData(
        at,
        `stylesheets must contain mockupsDir-relative public CSS paths: ${String(stylesheet)}`,
      );
  }
  const definition: ComponentDefinition = branded({
    ...value,
    __viaDefine: true,
    kind: "component",
    propSchema: structuredClone(value.propSchema),
    controls: structuredClone(controls),
    slots: [...slots].sort(),
    stylesheets: [...(declared as string[])],
  });
  return definition;
}

/** Validate one flattened component variant against its registered parent. */
export function validateComponentVariantDefinition(
  input: ComponentVariantDefinition,
  parent: ComponentDefinition,
): ComponentVariantDefinition {
  const at = `Component ${parent.path} / ${String(input.path)}`;
  if (input.variantOf !== parent.path)
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
  index: number,
): ComponentVariantDefinition {
  const at =
    parent.path === undefined ? "Component" : `Component ${parent.path}`;
  plainKeys(variant, at);
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
    `${at} / ${variant.slug}`,
  );
  validateControlledValues(
    parent.controls,
    values.data,
    `${at} / ${variant.slug}`,
  );
  const retired: Record<string, unknown> = {};
  for (const field of ["dependencies", "ownedDependencies"] as const)
    if (Object.hasOwn(variant, field))
      retired[field] = Reflect.get(variant, field);
  const definition: ComponentVariantDefinition = branded({
    ...retired,
    __viaDefine: true,
    ...(parent.colorSchemes ? { colorSchemes: [...parent.colorSchemes] } : {}),
    description: variant.description ?? parent.description,
    slug: variant.slug,
    kind: "component",
    props: { ...values.data, ...values.slots },
    relatedDocs: [...parent.relatedDocs],
    suppliedSlots: Object.keys(values.slots).sort(),
    ...(parent.tags ? { tags: [...parent.tags] } : {}),
    title: variant.title,
    variantOf: "",
    [VARIANT_PARENT]: parent,
    [VARIANT_INDEX]: index,
    ...unknownFields(variant, "component-variant"),
    ...(variant.movedFrom === undefined
      ? {}
      : { movedFrom: variant.movedFrom }),
  });
  if (parent.definedIn !== undefined) definition.definedIn = parent.definedIn;
  return definition;
}
