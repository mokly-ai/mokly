import { decodeProps, encodeProps } from "../components/codec.js";
import type { ComponentControl } from "../components/control_types.js";
import {
  validateControlledValues,
  validateControls,
} from "../components/controls.js";
import { invalidData } from "../components/data.js";
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
} from "../components/manifest_types.js";
import { validatePropSchema } from "../components/profile_schema.js";
import type {
  ComponentWireProps,
  PropSchema,
} from "../components/prop_types.js";
import { validateProps } from "../components/props.js";

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

/** Read the controls of one entry, which name only its declared props. */
export function readControls(
  value: unknown,
  schema: PropSchema,
  context = "$catalogue",
): Readonly<Record<string, ComponentControl>> {
  object(value);
  validateControls(schema, value, context);
  return structuredClone(value);
}

/** Read an entry's own or merged props and check them against its schema. */
export function readEntryProps(
  value: unknown,
  schema: PropSchema,
  controls: Readonly<Record<string, ComponentControl>>,
  context = "$catalogue",
): ComponentWireProps {
  const props = readProps(value);
  const decoded = validateProps(schema, decodeProps(props), context);
  validateControlledValues(controls, decoded, context);
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
