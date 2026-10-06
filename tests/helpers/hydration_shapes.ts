import type { ManifestEntry } from "@mokly/viewer/data";

import { entryRoute } from "../../packages/viewer/dist/data.js";

/** One catalogue route that hydrates on behalf of every entry of its shape. */
export interface HydrationShapeRoute {
  entryPath: string;
  route: string;
  shape: string;
}

const CONTROL_IDENTITY: ReadonlySet<string> = new Set(["kind", "label"]);

/** Empty strings, arrays and objects count as absent, like missing values. */
function present(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function presentKeys(
  value: object,
  skipped: ReadonlySet<string> = new Set(),
): string[] {
  return Object.entries(value)
    .filter(([key, item]) => !skipped.has(key) && present(item))
    .map(([key]) => key)
    .sort();
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/**
 * The JSON text of the entry properties that select shell rendering paths, as
 * the development hydration coverage contract defines them.
 */
export function hydrationShapeKey(entry: ManifestEntry): string {
  const views = "componentViews" in entry ? (entry.componentViews ?? []) : [];
  const instances = views.flatMap((view) => view.instances);
  const ownProps = "props" in entry ? [entry.props] : [];
  const controls = "controls" in entry ? Object.values(entry.controls) : [];
  const propFields =
    "propSchema" in entry ? Object.values(entry.propSchema.properties) : [];
  return JSON.stringify({
    kind: entry.kind,
    fields: presentKeys(entry),
    colorSchemes: sortedUnique(
      "colorSchemes" in entry ? entry.colorSchemes : [],
    ),
    controls: sortedUnique(
      controls.map(
        (control) =>
          `${control.kind}(${presentKeys(control, CONTROL_IDENTITY).join(",")})`,
      ),
    ),
    propSchema: sortedUnique(
      propFields.map(
        (field) => `${field.schema.kind}${field.optional === true ? "?" : ""}`,
      ),
    ),
    values: sortedUnique(
      [...ownProps, ...instances.map((instance) => instance.props)].flatMap(
        (props) => Object.values(props).map(([tag]) => tag),
      ),
    ),
    instances: instances.length > 0,
    slotted: instances.some((instance) => instance.slotKey !== undefined),
  });
}

/** The first entry of each shape, in manifest order, with its route. */
export function hydrationShapeSample(
  entries: readonly ManifestEntry[],
): HydrationShapeRoute[] {
  const sample = new Map<string, HydrationShapeRoute>();
  for (const entry of entries) {
    const shape = hydrationShapeKey(entry);
    if (!sample.has(shape))
      sample.set(shape, {
        entryPath: entry.path,
        route: entryRoute(entry.path),
        shape,
      });
  }
  return [...sample.values()];
}
