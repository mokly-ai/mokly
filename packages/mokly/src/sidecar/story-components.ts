import { wrapperBrand } from "../authoring/runtime.js";
import type { EntryBinding } from "../generated/sidecar/EntryBinding.js";

const memoType = Symbol.for("react.memo");
const forwardRefType = Symbol.for("react.forward_ref");

function identity(value: unknown): value is object {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)
  );
}

export function innerType(type: object): object | undefined {
  if (!("$$typeof" in type)) return;
  if (type.$$typeof === memoType && "type" in type && identity(type.type))
    return type.type;
  if (
    type.$$typeof === forwardRefType &&
    "render" in type &&
    identity(type.render)
  )
    return type.render;
}

export function storyComponentType(value: unknown): value is object {
  if (typeof value === "function") return !(wrapperBrand in value);
  if (!identity(value)) return false;
  const seen = new Set<object>();
  for (
    let type: object | undefined = value;
    type && !seen.has(type);
    type = innerType(type)
  ) {
    if (wrapperBrand in type) return false;
    seen.add(type);
  }
  return true;
}

export class StoryComponents {
  private readonly byType = new Map<object, string[]>();
  private readonly byInner = new Map<object, string[]>();

  register(type: unknown, handle: string): void {
    if (!storyComponentType(type)) return;
    append(this.byType, type, handle);
    const inner = innerType(type);
    if (inner) append(this.byInner, inner, handle);
  }

  handles(type: object): string[] {
    const inner = innerType(type);
    return [
      ...(this.byType.get(type) ?? []),
      ...(this.byInner.get(type) ?? []),
      ...(inner ? (this.byType.get(inner) ?? []) : []),
    ];
  }
}

export function storyComponentPath(
  handles: readonly string[],
  entries: Record<string, EntryBinding>,
  ownHandle: string | undefined,
): string | undefined {
  if (ownHandle && handles.includes(ownHandle)) return;
  let path: string | undefined;
  for (const handle of handles) {
    const candidate = entries[handle]?.path;
    if (candidate !== undefined && (path === undefined || candidate < path))
      path = candidate;
  }
  return path;
}

function append(
  map: Map<object, string[]>,
  type: object,
  handle: string,
): void {
  const registrations = map.get(type);
  if (registrations) registrations.push(handle);
  else map.set(type, [handle]);
}
