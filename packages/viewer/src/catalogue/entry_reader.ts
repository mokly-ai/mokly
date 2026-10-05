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
  ShellCatalogueRoutedEntry,
  ShellCatalogueUsage,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueChanges,
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueEntry,
  CatalogueDocument,
  CataloguePage,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueUseCase,
  CatalogueView,
  ComparisonSelection,
} from "./types.js";
import {
  array,
  tag,
  boolean,
  choice,
  entryPath,
  object,
  relatedDoc,
  repositoryPath,
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

function readChanges(value: unknown): CatalogueChanges {
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
function readComparison(value: unknown): ComparisonSelection {
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
function readUsage(value: unknown): CatalogueUsage {
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
function readShellUsage(value: unknown): ShellCatalogueUsage {
  const input = object(value),
    status = choice(input.status, [
      "ready",
      "pending",
      "unavailable",
      "omitted",
    ] as const);
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
function readView(value: unknown): CatalogueView {
  return readViewWithUsage(value, readUsage);
}
function readShellView(value: unknown): ShellCatalogueView {
  return readViewWithUsage(value, readShellUsage);
}
function readViewWithUsage<Usage extends ShellCatalogueUsage>(
  value: unknown,
  read: (value: unknown) => Usage,
): Omit<CatalogueView, "usage"> & { usage: Usage } {
  const input = object(value);
  return {
    viewport: choice(input.viewport, ["mobile", "desktop"] as const),
    colorScheme: choice(input.colorScheme, ["light", "dark"] as const),
    usage: read(input.usage),
    comparison: readComparison(input.comparison),
  };
}
function common(input: Record<string, unknown>): CatalogueEntry {
  const details = object(input.details);
  const result: CatalogueEntry = {
    path: entryPath(input.path),
    title: text(input.title),
    tags: array(input.tags).map(tag),
    ...(input.previousPath === undefined
      ? {}
      : { previousPath: entryPath(input.previousPath) }),
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
export function readEntry(value: unknown): CatalogueRecord {
  return readEntryWithViews(value, readView);
}
export function readShellEntry(value: unknown): ShellCatalogueRoutedEntry {
  return readEntryWithViews(value, readShellView);
}

type ParsedVariant<View extends ShellCatalogueView> = Omit<
  CatalogueComponentVariant,
  "views"
> & { views: readonly View[] };
type ParsedEntry<View extends ShellCatalogueView> =
  | (Omit<CatalogueScreen, "views"> & { views: readonly View[] })
  | CataloguePage
  | CatalogueDocument
  | CatalogueUseCase
  | CatalogueComponent
  | ParsedVariant<View>;

function readEntryWithViews<View extends ShellCatalogueView>(
  value: unknown,
  readCatalogueView: (value: unknown) => View,
): ParsedEntry<View> {
  const input = object(value),
    base = common(input);
  if (Object.hasOwn(input, "preview"))
    invalidData("$catalogue", "preview is only valid on a removed entry");
  const kind = choice(input.kind, [
    "screen",
    "page",
    "document",
    "use-case",
    "component",
  ] as const);
  if (kind === "page")
    return {
      ...base,
      kind,
    };
  if (kind === "use-case")
    return {
      ...base,
      kind,
      steps: array(input.steps).map((raw) => {
        const step = object(raw);
        return {
          screenPath: entryPath(step.screenPath),
          ...(step.title !== undefined ? { title: text(step.title) } : {}),
          ...(step.description !== undefined
            ? { description: string(step.description) }
            : {}),
        };
      }),
    };
  const axes = {
    colorSchemes: array(input.colorSchemes).map((value) =>
      choice(value, ["light", "dark"] as const),
    ),
  };
  if (kind === "document") return { ...base, kind, ...axes };
  if (kind === "screen")
    return {
      ...base,
      kind,
      ...axes,
      views: array(input.views).map(readCatalogueView),
      useCasePaths: array(input.useCasePaths).map(entryPath),
      ...(input.address !== undefined
        ? { address: string(input.address) }
        : {}),
      ...(input.variantOf !== undefined
        ? { variantOf: entryPath(input.variantOf) }
        : {}),
    };
  if (input.variantOf !== undefined)
    return {
      ...base,
      kind,
      ...axes,
      variantOf: entryPath(input.variantOf),
      props: readProps(input.props),
      suppliedSlots: array(input.suppliedSlots).map(string),
      views: array(input.views).map(readCatalogueView),
      comparison: readComparison(input.comparison),
    };
  const schema = readSchema(input.propSchema);
  if (schema.kind !== "object")
    invalidData("$catalogue", "component requires object schema");
  return {
    ...base,
    kind,
    ...axes,
    propSchema: schema,
    slots: array(input.slots).map(string),
    controls: readControls(input.controls, schema),
  };
}

function absent(
  input: Record<string, unknown>,
  fields: readonly string[],
): void {
  if (fields.some((key) => Object.hasOwn(input, key)))
    invalidData("$catalogue", "state cannot carry ready evidence");
}
