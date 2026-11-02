import { decodeProps, encodeProps } from "../components/codec.js";
import type { ComponentControl } from "../components/control_types.js";
import { validateControls } from "../components/controls.js";
import { invalidData, plainKeys, record } from "../components/data.js";
import { validatePropSchema } from "../components/profile_schema.js";
import type {
  ComponentWireProps,
  PropSchema,
} from "../components/prop_types.js";
import { validateProps } from "../components/props.js";
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
} from "../components/view_types.js";

import {
  choice,
  counter,
  hash,
  entryPath,
  object,
  repositoryPath,
  string,
} from "./values.js";

/** Read one prop schema under the JSON Schema profile as an owned copy. */
export function readSchema(value: unknown, context = "$catalogue"): PropSchema {
  validatePropSchema(value, context);
  return structuredClone(value);
}

/** The fields each control kind defines beside `kind`, `label`, `description`. */
const CONTROL_FIELDS: Readonly<Record<string, readonly string[]>> = {
  text: ["maxLength"],
  boolean: [],
  number: ["minimum", "maximum", "step"],
  select: ["options"],
};

/** Keep only the listed own fields of a record; other values pass unchanged. */
function known(value: unknown, fields: readonly string[]): unknown {
  if (!record(value)) return value;
  return Object.fromEntries(
    fields.flatMap((field) =>
      Object.hasOwn(value, field) ? [[field, value[field]]] : [],
    ),
  );
}

/**
 * Read the controls of one entry, which name only its declared props. Each
 * control keeps the fields its kind defines; any other field is ignored, and
 * an unknown kind fails validation.
 */
export function readControls(
  value: unknown,
  schema: PropSchema,
  context = "$catalogue",
): Readonly<Record<string, ComponentControl>> {
  const input = object(value);
  const controls = Object.fromEntries(
    plainKeys(input, context).map((key) => {
      const control = input[key];
      const kind = record(control) ? control.kind : undefined;
      const fields =
        typeof kind === "string" && Object.hasOwn(CONTROL_FIELDS, kind)
          ? CONTROL_FIELDS[kind]!
          : undefined;
      if (!fields) return [key, control];
      const read = known(control, ["kind", "label", "description", ...fields]);
      if (record(read) && Array.isArray(read.options))
        read.options = read.options.map((option) =>
          known(option, ["label", "value"]),
        );
      return [key, read];
    }),
  );
  validateControls(schema, controls, context);
  return structuredClone(controls);
}

/** Read an entry's own or merged props and check them against its schema. */
export function readEntryProps(
  value: unknown,
  schema: PropSchema,
  context = "$catalogue",
): ComponentWireProps {
  const props = readProps(value);
  validateProps(schema, decodeProps(props), context);
  return props;
}

export function readProps(value: unknown): ComponentWireProps {
  return encodeProps(decodeProps(value));
}

function owner(value: unknown): ComponentInputOwner {
  const input = object(value);
  const kind = choice(input.kind, ["entry", "instance"] as const);
  if (kind === "entry" && Object.hasOwn(input, "instanceKey"))
    invalidData("$catalogue", "entry owner cannot name an instance");
  return kind === "entry"
    ? { kind: "entry" }
    : { kind: "instance", instanceKey: hash(input.instanceKey) };
}

export function readInstance(value: unknown): ComponentInstanceRecord {
  const input = object(value);
  const result: ComponentInstanceRecord = {
    key: hash(input.key),
    id: string(input.id),
    componentId: entryPath(input.componentId),
    owner: owner(input.owner),
    order: counter(input.order),
    props: readProps(input.props),
    propsKey: string(input.propsKey),
  };
  if (input.slotKey !== undefined) result.slotKey = hash(input.slotKey);
  if (input.source !== undefined) {
    const source = object(input.source);
    const line = counter(source.line),
      column = counter(source.column);
    if (!line || !column)
      invalidData("$catalogue", "source coordinates must be positive");
    result.source = { path: repositoryPath(source.path), line, column };
  }
  return result;
}

export function readSlot(value: unknown): ComponentSlotRecord {
  const input = object(value);
  const result: ComponentSlotRecord = {
    key: hash(input.key),
    instanceKey: hash(input.instanceKey),
    name: string(input.name),
    owner: owner(input.owner),
  };
  if (input.sourceSlotKey !== undefined)
    result.sourceSlotKey = hash(input.sourceSlotKey);
  return result;
}

export function readRange(value: unknown): ComponentRangeRecord {
  const input = object(value),
    target = object(input.target);
  const kind = choice(target.kind, ["instance", "slot", "root"] as const);
  if (
    kind === "root" &&
    (Object.hasOwn(target, "instanceKey") || Object.hasOwn(target, "slotKey"))
  )
    invalidData("$catalogue", "root range has no instance or slot");
  if (Object.hasOwn(target, kind === "instance" ? "slotKey" : "instanceKey"))
    invalidData("$catalogue", "range must name exactly one target");
  const result: ComponentRangeRecord = {
    id: string(input.id),
    target:
      kind === "instance"
        ? { kind: "instance", instanceKey: hash(target.instanceKey) }
        : kind === "slot"
          ? { kind: "slot", slotKey: hash(target.slotKey) }
          : { kind: "root" },
  };
  if (input.parentId !== undefined) result.parentId = string(input.parentId);
  return result;
}
