/** Field readers for the entry records of the catalogue index v7. */

import { invalidData } from "../components/data.js";
import type { ComponentWireProps } from "../components/prop_types.js";

import {
  readControls,
  readEntryProps,
  readSchema,
} from "./component_values.js";
import type {
  CatalogueChanges,
  CatalogueComponent,
  CatalogueEntry,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
  ComparisonSelection,
} from "./types.js";
import {
  array,
  boolean,
  choice,
  entryPath,
  hash,
  object,
  relatedDoc,
  repositoryPath,
  string,
  tag,
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
const SCHEMES = ["light", "dark"] as const;

/**
 * Read one current or historical entry record of any kind: the fields v7
 * defines, ignoring any other field a newer writer adds.
 */
export function readEntry(value: unknown): CatalogueRecord {
  const input = object(value);
  const base = common(input);
  const kind = choice(input.kind, [
    "screen",
    "page",
    "document",
    "use-case",
    "component",
  ] as const);
  switch (kind) {
    case "page":
      return { ...base, kind, documentKey: hash(input.documentKey) };
    case "use-case":
      return { ...base, kind, steps: array(input.steps).map(readStep) };
    case "document": {
      const colorSchemes = schemes(input.colorSchemes);
      return {
        ...base,
        kind,
        colorSchemes,
        documentKeys: array(input.documentKeys).map((raw) => {
          const key = object(raw);
          return {
            colorScheme: choice(key.colorScheme, SCHEMES),
            documentKey: hash(key.documentKey),
          };
        }),
      };
    }
    case "screen":
      return {
        ...base,
        ...visual(input),
        kind,
        useCasePaths: array(input.useCasePaths).map(entryPath),
        ...(input.address !== undefined
          ? { address: string(input.address) }
          : {}),
        ...(input.variantOf !== undefined
          ? { variantOf: entryPath(input.variantOf) }
          : {}),
      } satisfies CatalogueScreen;
    case "component":
      return {
        ...base,
        ...visual(input),
        kind,
        slots: array(input.slots).map(string),
        suppliedSlots: array(input.suppliedSlots).map(string),
        comparison: readComparison(input.comparison),
        ...(input.variantOf !== undefined
          ? { variantOf: entryPath(input.variantOf) }
          : {}),
      } satisfies CatalogueComponent;
  }
}

/** Read one view of a screen or component with its document key. */
function readView(value: unknown): CatalogueView {
  const input = object(value);
  return {
    viewport: choice(input.viewport, ["mobile", "desktop"] as const),
    colorScheme: choice(input.colorScheme, SCHEMES),
    comparison: readComparison(input.comparison),
    documentKey: hash(input.documentKey),
  };
}

/** The axis list of a screen, component or document, light first. */
function schemes(value: unknown): CatalogueScreen["colorSchemes"] {
  return array(value).map((scheme) => choice(scheme, SCHEMES));
}

function visual(input: Record<string, unknown>) {
  const propSchema = readSchema(input.propSchema);
  const controls = readControls(input.controls, propSchema);
  return {
    colorSchemes: schemes(input.colorSchemes),
    propSchema,
    props: wire(readEntryProps(input.props, propSchema, controls)),
    controls,
    views: array(input.views).map(readView),
  };
}

function readStep(value: unknown) {
  const step = object(value);
  return {
    screenPath: entryPath(step.screenPath),
    ...(step.title !== undefined ? { title: text(step.title) } : {}),
    ...(step.description !== undefined
      ? { description: string(step.description) }
      : {}),
  };
}

function common(input: Record<string, unknown>): CatalogueEntry {
  const details = object(input.details);
  return {
    path: entryPath(input.path),
    title: text(input.title),
    tags: array(input.tags).map(tag),
    ...(input.previousPath === undefined
      ? {}
      : { previousPath: entryPath(input.previousPath) }),
    changes: readChanges(input.changes),
    details: {
      description: string(details.description),
      ...(details.rationale === undefined
        ? {}
        : { rationale: string(details.rationale) }),
      relatedDocs: array(details.relatedDocs).map(relatedDoc),
      sourcePath: repositoryPath(details.sourcePath),
    },
  };
}

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
    status = choice(input.status, CHANGE_STATUSES);
  if (status !== "ready") absent(input, ["kind", "eligible"]);
  return status === "ready"
    ? {
        status,
        kind: choice(input.kind, KINDS),
        eligible: boolean(input.eligible),
      }
    : { status };
}

function absent(
  input: Record<string, unknown>,
  fields: readonly string[],
): void {
  if (fields.some((key) => Object.hasOwn(input, key)))
    invalidData("$catalogue", "state cannot carry ready evidence");
}

/** The generated shapes spell wire tuples as mutable arrays. */
function wire(props: ComponentWireProps): CatalogueScreen["props"] {
  return props as CatalogueScreen["props"];
}
