import { invalidData } from "../components/data.js";

import {
  readControls,
  readInstance,
  readProps,
  readRange,
  readSchema,
  readSlot,
} from "./component_values.js";
import type {
  CatalogueChanges,
  CatalogueCollection,
  CatalogueEntry,
  CatalogueRoutedEntry,
  CatalogueUsage,
  CatalogueVariant,
  CatalogueView,
  ComparisonSelection,
} from "./types.js";
import {
  array,
  boolean,
  choice,
  id,
  object,
  publicPath,
  relatedDoc,
  repositoryPath,
  route,
  string,
  text,
} from "./values.js";

export const CHANGE_STATUSES = [
  "preparing",
  "pending",
  "ready",
  "unavailable",
  "disabled",
] as const;
const KINDS = ["added", "changed", "removed", "unmodified"] as const;

export function readChanges(value: unknown): CatalogueChanges {
  const input = object(value),
    status = choice(input.status, CHANGE_STATUSES);
  if (status !== "ready") absent(input, ["kind", "included"]);
  return status === "ready"
    ? {
        status,
        kind: choice(input.kind, KINDS),
        included: boolean(input.included),
      }
    : { status };
}
export function readComparison(value: unknown): ComparisonSelection {
  const input = object(value),
    status = choice(input.status, [
      "ready",
      "pending",
      "unavailable",
      "disabled",
    ] as const);
  if (status !== "ready") absent(input, ["kind", "eligible"]);
  return status === "ready"
    ? {
        status,
        kind: choice(input.kind, KINDS),
        eligible: boolean(input.eligible),
      }
    : { status };
}
export function readUsage(value: unknown): CatalogueUsage {
  const input = object(value),
    status = choice(input.status, ["ready", "pending", "unavailable"] as const);
  if (status !== "ready") absent(input, ["instances", "slots", "ranges"]);
  return status === "ready"
    ? {
        status,
        instances: array(input.instances).map(readInstance),
        slots: array(input.slots).map(readSlot),
        ranges: array(input.ranges).map(readRange),
      }
    : { status };
}
export function readView(value: unknown): CatalogueView {
  const input = object(value);
  return {
    viewport: choice(input.viewport, ["mobile", "desktop"] as const),
    colorScheme: choice(input.colorScheme, ["light", "dark"] as const),
    fragmentPath: publicPath(input.fragmentPath),
    usage: readUsage(input.usage),
    comparison: readComparison(input.comparison),
  };
}
function common(input: Record<string, unknown>): CatalogueEntry {
  const details = object(input.details);
  const result: CatalogueEntry = {
    id: id(input.id),
    title: text(input.title),
    tags: array(input.tags).map(id),
    changes: readChanges(input.changes),
    details: {
      description: string(details.description),
      relatedDocs: array(details.relatedDocs).map(relatedDoc),
      sourcePath: repositoryPath(details.sourcePath),
      dependencies: array(details.dependencies).map(repositoryPath),
    },
  };
  if (details.rationale !== undefined)
    result.details.rationale = string(details.rationale);
  return result;
}
export function readCollection(value: unknown): CatalogueCollection {
  const input = object(value);
  return {
    ...common(input),
    kind: choice(input.kind, ["collection"] as const),
    childIds: array(input.childIds).map(id),
  };
}
export function readEntry(value: unknown): CatalogueRoutedEntry {
  const input = object(value),
    base = common(input),
    path = route(input.route);
  const kind = choice(input.kind, [
    "screen",
    "page",
    "use-case",
    "component",
  ] as const);
  if (kind === "page")
    return {
      ...base,
      kind,
      route: path,
      documentPath: publicPath(input.documentPath),
    };
  if (kind === "use-case")
    return {
      ...base,
      kind,
      route: path,
      steps: array(input.steps).map((raw) => {
        const step = object(raw);
        return {
          screenId: id(step.screenId),
          ...(step.title !== undefined ? { title: text(step.title) } : {}),
          ...(step.description !== undefined
            ? { description: string(step.description) }
            : {}),
        };
      }),
    };
  const axes = {
    viewports: array(input.viewports).map((value) =>
      choice(value, ["mobile", "desktop"] as const),
    ),
    colorSchemes: array(input.colorSchemes).map((value) =>
      choice(value, ["light", "dark"] as const),
    ),
  };
  if (kind === "screen")
    return {
      ...base,
      kind,
      route: path,
      ...axes,
      views: array(input.views).map(readView),
      useCaseIds: array(input.useCaseIds).map(id),
      ...(input.address !== undefined
        ? { address: string(input.address) }
        : {}),
    };
  const schema = readSchema(input.propSchema);
  if (schema.kind !== "object")
    invalidData("$catalogue", "component requires object schema");
  return {
    ...base,
    kind,
    route: path,
    ...axes,
    propSchema: schema,
    slots: array(input.slots).map(string),
    controls: readControls(input.controls, schema),
    variants: array(input.variants).map(readVariant),
  };
}
function readVariant(value: unknown): CatalogueVariant {
  const input = object(value);
  return {
    id: id(input.id),
    title: text(input.title),
    props: readProps(input.props),
    suppliedSlots: array(input.suppliedSlots).map(string),
    views: array(input.views).map(readView),
    comparison: readComparison(input.comparison),
    ...(input.description !== undefined
      ? { description: text(input.description) }
      : {}),
  };
}

function absent(
  input: Record<string, unknown>,
  fields: readonly string[],
): void {
  if (fields.some((key) => Object.hasOwn(input, key)))
    invalidData("$catalogue", "state cannot carry ready evidence");
}
