import { decodeProps, encodeProps } from "../components/codec.js";
import type { ComponentControl } from "../components/control_types.js";
import { validateControls } from "../components/controls.js";
import { invalidData } from "../components/data.js";
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
} from "../components/manifest_types.js";
import type {
  ComponentWireProps,
  DataPropSchema,
  ObjectPropSchema,
} from "../components/prop_types.js";
import { validatePropSchema } from "../components/schema.js";

import {
  array,
  choice,
  counter,
  hash,
  id,
  object,
  repositoryPath,
  string,
} from "./values.js";

/** Select contract fields before invoking the strict shared component validators. */
function select(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const input = object(value);
  return Object.fromEntries(
    keys
      .filter((key) => Object.hasOwn(input, key))
      .map((key) => [key, input[key]]),
  );
}

export function readSchema(value: unknown): DataPropSchema {
  const input = object(value);
  const kind = choice(input.kind, [
    "string",
    "boolean",
    "number",
    "null",
    "enum",
    "array",
    "object",
    "union",
  ] as const);
  let result: Record<string, unknown>;
  switch (kind) {
    case "object":
      result = {
        kind,
        properties: Object.fromEntries(
          Object.entries(object(input.properties)).map(([key, field]) => [
            key,
            {
              ...select(field, ["optional"]),
              schema: readSchema(object(field).schema),
            },
          ]),
        ),
      };
      break;
    case "array":
      result = {
        ...select(input, ["minItems", "maxItems"]),
        kind,
        items: readSchema(input.items),
      };
      break;
    case "union":
      result = { kind, anyOf: array(input.anyOf).map(readSchema) };
      break;
    case "string":
      result = select(input, ["kind", "minLength", "maxLength"]);
      break;
    case "number":
      result = select(input, ["kind", "minimum", "maximum", "integer"]);
      break;
    case "enum":
      result = { kind, values: array(input.values).slice() };
      break;
    default:
      result = { kind };
  }
  validatePropSchema(result);
  return result;
}

export function readControls(
  value: unknown,
  schema: ObjectPropSchema,
): Readonly<Record<string, ComponentControl>> {
  const result = Object.fromEntries(
    Object.entries(object(value)).map(([key, raw]) => {
      const input = object(raw);
      const kind = choice(input.kind, [
        "text",
        "boolean",
        "number",
        "select",
      ] as const);
      const common = select(input, ["kind", "label", "description"]);
      const control =
        kind === "select"
          ? {
              ...common,
              options: array(input.options).map((option) =>
                select(option, ["label", "value"]),
              ),
            }
          : {
              ...common,
              ...select(
                input,
                kind === "text"
                  ? ["maxLength"]
                  : kind === "number"
                    ? ["minimum", "maximum", "step"]
                    : [],
              ),
            };
      return [key, control];
    }),
  );
  validateControls(schema, result);
  return result;
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
    id: id(input.id),
    componentId: id(input.componentId),
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
  const kind = choice(target.kind, ["instance", "slot"] as const);
  if (Object.hasOwn(target, kind === "instance" ? "slotKey" : "instanceKey"))
    invalidData("$catalogue", "range must name exactly one target");
  const result: ComponentRangeRecord = {
    id: string(input.id),
    target:
      kind === "instance"
        ? { kind: "instance", instanceKey: hash(target.instanceKey) }
        : { kind: "slot", slotKey: hash(target.slotKey) },
  };
  if (input.parentId !== undefined) result.parentId = string(input.parentId);
  return result;
}
