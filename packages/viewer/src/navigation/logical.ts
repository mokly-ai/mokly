const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
const WINDOWS_DEVICE_NAME = /^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])$/i;
const LOGICAL_FRAGMENT = /^[A-Za-z][A-Za-z0-9_:.-]*$/;

/** A parsed complete logical catalogue destination. */
export interface LogicalTarget {
  fragment?: string;
  path: string;
}

/** Return whether a value is a reserved Windows device filename stem. */
export function isWindowsDeviceName(value: unknown): value is string {
  return typeof value === "string" && WINDOWS_DEVICE_NAME.test(value);
}

/** Check a portable, case-preserving catalogue path segment. */
export function isPathSegment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    PATH_SEGMENT.test(value) &&
    !isWindowsDeviceName(value)
  );
}

/** Check a complete catalogue path without leading or trailing separators. */
export function isEntryPath(value: unknown): value is string {
  return typeof value === "string" && value.split("/").every(isPathSegment);
}

/** Find conflicting spellings of a path or any of its folder prefixes. */
export function firstPathCaseCollision(
  paths: readonly string[],
): readonly [string, string] | undefined {
  const prefixes = new Map<string, string>();
  for (const path of paths) {
    const segments = path.split("/");
    for (let length = 1; length <= segments.length; length++) {
      const prefix = segments.slice(0, length).join("/");
      const folded = prefix.toLowerCase();
      const previous = prefixes.get(folded);
      if (previous !== undefined && previous !== prefix)
        return previous < prefix ? [previous, prefix] : [prefix, previous];
      prefixes.set(folded, prefix);
    }
  }
  return undefined;
}

/** Check complete or explicitly relative logical paths without coercion. */
export function isLinkPath(value: unknown): value is string {
  if (isEntryPath(value)) return true;
  if (typeof value !== "string" || !/^\.\.?\//.test(value)) return false;
  return value
    .split("/")
    .every(
      (segment) =>
        segment === "." || segment === ".." || isPathSegment(segment),
    );
}

/** Resolve a logical path relative to the containing entry's folder. */
export function resolveLinkPath(
  value: string,
  base: string,
): string | undefined {
  if (!/^\.\.?\//.test(value)) return isEntryPath(value) ? value : undefined;
  if (!isLinkPath(value) || (base !== "" && !isEntryPath(base)))
    return undefined;
  const segments = base === "" ? [] : base.split("/");
  for (const segment of value.split("/")) {
    if (segment === ".") continue;
    if (segment === "..") {
      if (!segments.length) return undefined;
      segments.pop();
    } else segments.push(segment);
  }
  const result = segments.join("/");
  return isEntryPath(result) ? result : undefined;
}

/** Check the bare logical HTML-fragment grammar. */
export function isLogicalFragment(value: unknown): value is string {
  return typeof value === "string" && LOGICAL_FRAGMENT.test(value);
}

/** Parse a complete `mock:<path>[#fragment]` value. */
export function parseLogicalTarget(value: unknown): LogicalTarget | undefined {
  if (typeof value !== "string" || !value.startsWith("mock:")) return undefined;
  const separator = value.indexOf("#", 5);
  const path = separator < 0 ? value.slice(5) : value.slice(5, separator);
  const fragment = separator < 0 ? undefined : value.slice(separator + 1);
  if (
    !isLinkPath(path) ||
    (fragment !== undefined && !isLogicalFragment(fragment))
  )
    return undefined;
  return fragment === undefined ? { path } : { fragment, path };
}

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

/** Validate tags and explicitly authored local instance and ignore ids. */
export function isKebabCase(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** Return whether a value is a canonical, portable repository-relative path. */
export function isSafeRepositoryPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes(":") &&
    !value.includes("\0") &&
    !value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  );
}
