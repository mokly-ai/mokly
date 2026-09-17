import type { ComponentInstanceRecord } from "./manifest_types.js";

/** Record-only resolution within one catalogue entry/variant/view scope. */
export type InstanceResolution = "present" | "moved" | "missing";

/** Resolve a previously selected instance using validated records from the same view. */
export function resolveInstance(
  previous: ComponentInstanceRecord,
  current: ComponentInstanceRecord | undefined,
): InstanceResolution {
  if (!current || previous.key !== current.key) return "missing";
  return previous.propsKey === current.propsKey &&
    previous.order === current.order &&
    (previous.slotKey ?? null) === (current.slotKey ?? null)
    ? "present"
    : "moved";
}
