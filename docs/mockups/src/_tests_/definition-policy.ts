/**
 * The authoring rules of `docs/protocol/cloud/mockups.md` that the loaded
 * definitions show: each entry module exports one definition, as its default
 * export; no definition lists dependencies; a screen draws every view through
 * one render of one named screen component, which its variants share with
 * props of their own; and a registered component declares a closed prop
 * schema, its own props and every slot that its variants fill.
 */

import { isValidElement } from "react";
import type { ReactNode } from "react";

import { variantParent } from "./catalogue-variants";
import type { CatalogueDefinition } from "./load-catalogue";

/** The four views that Mokly renders for each screen. */
const views = [
  { viewport: "mobile", colorScheme: "light" },
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "light" },
  { viewport: "desktop", colorScheme: "dark" },
] as const;

/** Fields that Mokly 0.18.0 removed: it derives each render's inputs from imports. */
const removedFields = ["dependencies", "ownedDependencies"] as const;

/** The kinds of the values that the Mokly define helpers return. */
const definitionKinds = new Set<unknown>([
  "screen",
  "component",
  "page",
  "useCase",
  "folder",
]);

function isDefinition(value: unknown): value is { kind: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    definitionKinds.has(value.kind)
  );
}

/** Each entry module exports one entry definition, as its default export. */
export function entryExportViolations(
  module: string,
  exports: Readonly<Record<string, unknown>>,
): string[] {
  const problems: string[] = [];
  const entry = exports.default;
  if (!isDefinition(entry) || entry.kind === "folder")
    problems.push("default export is the entry definition: " + module);
  for (const [name, value] of Object.entries(exports))
    if (
      name !== "default" &&
      (isDefinition(value) ||
        (Array.isArray(value) && value.some(isDefinition)))
    )
      problems.push("one definition per entry module: " + module + " " + name);
  return problems;
}

/**
 * What one screen entry draws in each view: a parent's render over its own
 * props, or a variant's parent's render over the variant's props laid over
 * the parent's. Nothing when no screen render reaches the entry.
 */
function screenViews(
  entry: CatalogueDefinition,
  parentOf: (path: string) => CatalogueDefinition | undefined,
): ReactNode[] {
  if (entry.kind !== "screen") return [];
  const parentPath = variantParent(entry);
  const parent = parentPath === undefined ? entry : parentOf(parentPath);
  if (parent?.kind !== "screen" || !("render" in parent)) return [];
  const props = {
    ...parent.props,
    ...(parent === entry ? undefined : entry.props),
  };
  return views.map((context) => parent.render(props, context));
}

/**
 * The component that one screen entry draws: one element type in all four
 * views, `missing` when a view draws no element, or `mixed` when the views
 * draw different types.
 */
export function drawnComponent(
  entry: CatalogueDefinition,
  parentOf: (path: string) => CatalogueDefinition | undefined,
): { type: unknown } | "missing" | "mixed" {
  const drawn = screenViews(entry, parentOf);
  const elements = drawn.filter((node) => isValidElement(node));
  if (drawn.length === 0 || elements.length !== drawn.length) return "missing";
  const types = new Set(elements.map((element) => element.type));
  const [type] = types;
  return types.size === 1 ? { type } : "mixed";
}

/**
 * Each screen and state draws one function component in every view, and no
 * other screen or state draws the same component.
 */
function screenRenderViolations(
  entries: readonly CatalogueDefinition[],
  parentOf: (path: string) => CatalogueDefinition | undefined,
): string[] {
  const problems: string[] = [];
  const owners = new Set<unknown>();
  for (const entry of entries) {
    if (entry.kind !== "screen") continue;
    const drawn = drawnComponent(entry, parentOf);
    if (drawn === "missing") {
      problems.push("both viewports required: " + entry.path);
      continue;
    }
    if (drawn === "mixed" || typeof drawn.type !== "function") {
      problems.push("one component per screen: " + entry.path);
      continue;
    }
    if (owners.has(drawn.type))
      problems.push(
        "screen component reused as a different screen: " + entry.path,
      );
    owners.add(drawn.type);
  }
  return problems;
}

/** Whether one prop schema is an object schema and every object in it is closed. */
function closedSchema(schema: unknown, root: boolean): boolean {
  if (typeof schema !== "object" || schema === null) return !root;
  const node = new Map<string, unknown>(Object.entries(schema));
  const type = node.get("type");
  const object =
    type === "object" || (Array.isArray(type) && type.includes("object"));
  if (
    (root && !object) ||
    (object && node.get("additionalProperties") !== false)
  )
    return false;
  const properties = node.get("properties");
  const anyOf = node.get("anyOf");
  return [
    ...(typeof properties === "object" && properties !== null
      ? Object.values(properties)
      : []),
    ...(Array.isArray(anyOf) ? anyOf : []),
    ...(node.has("items") ? [node.get("items")] : []),
  ].every((child) => closedSchema(child, false));
}

/**
 * A registered component declares a closed prop schema and its own props,
 * and each saved variant fills only the slots that its component declares.
 */
function componentViolations(
  entries: readonly CatalogueDefinition[],
): string[] {
  const problems: string[] = [];
  const slots = new Map<string, readonly string[]>();
  for (const entry of entries) {
    if (entry.kind !== "component" || !("propSchema" in entry)) continue;
    slots.set(entry.path, entry.slots ?? []);
    if (!closedSchema(entry.propSchema, true))
      problems.push("closed prop schema: " + entry.path);
    if (entry.props === undefined)
      problems.push("own props required: " + entry.path);
  }
  for (const entry of entries) {
    if (entry.kind !== "component" || "propSchema" in entry) continue;
    const declared = slots.get(entry.variantOf) ?? [];
    for (const slot of Object.keys(entry.slots ?? {}))
      if (!declared.includes(slot))
        problems.push("declared slots only: " + entry.path + " " + slot);
  }
  return problems;
}

/** The definition rules above, over one set of loaded definitions. */
export function definitionViolations(
  entries: readonly CatalogueDefinition[],
): string[] {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const problems: string[] = [];
  for (const entry of entries) {
    for (const field of removedFields)
      if (field in entry)
        problems.push("no declared dependencies: " + entry.path);
    if (variantParent(entry) === undefined) continue;
    if ("render" in entry)
      problems.push("variant shares its parent's render: " + entry.path);
    const props = "props" in entry ? entry.props : undefined;
    if (typeof props !== "object" || props === null)
      problems.push("variant sets its own props: " + entry.path);
  }
  return [
    ...problems,
    ...screenRenderViolations(entries, (path) => byPath.get(path)),
    ...componentViolations(entries),
  ];
}
