import { isEntryPath, parseLogicalTarget } from "@mokly/model";
import type { LogicalTarget } from "@mokly/model";

/** Parse the marker form `<path>[#fragment]`. */
export function parseLogicalMarker(value: unknown): LogicalTarget | undefined {
  if (typeof value !== "string") return undefined;
  const target = parseLogicalTarget(`mock:${value}`);
  return target && isEntryPath(target.path) ? target : undefined;
}

/** Compose a validated target's logical-marker bytes. */
export function logicalMarker(target: LogicalTarget): string {
  return `${target.path}${target.fragment ? `#${target.fragment}` : ""}`;
}
