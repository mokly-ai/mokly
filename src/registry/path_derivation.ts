import { isEntryPath, isPathSegment } from "@mokly/viewer/data";

/** Pure root-relative path inputs; filesystem resolution belongs to discovery. */
export interface PathDerivationInput {
  file: string;
  location: string;
  prefix?: string;
  transparent?: readonly string[];
  slug?: unknown;
  path?: unknown;
  document?: boolean;
  parentPath?: string;
}

/** A contract diagnostic with complete, already-attributed text. */
export interface PathDiagnostic {
  code: string;
  message: string;
}

/** Valid identity and the structural index fact used before manifest emission. */
export interface DerivedPath {
  path: string;
  slug: string;
  index: boolean;
}

/** Apply only prefix, transparent directories, leaf, index, and declared override. */
export function deriveEntryPath(
  input: PathDerivationInput,
): DerivedPath | PathDiagnostic {
  const parts = input.file.split("/");
  const filename = parts.pop() ?? "";
  const fallback = input.document
    ? filename.replace(/\.md$/i, "")
    : filename.split(".")[0];
  const slug =
    input.slug === undefined && input.parentPath === undefined
      ? fallback
      : input.slug;
  const index =
    input.parentPath === undefined &&
    typeof slug === "string" &&
    (input.document ? /^(?:readme|index)$/i.test(slug) : slug === "index");
  if (input.parentPath === undefined && input.path !== undefined) {
    if (!isEntryPath(input.path))
      return invalidPath(input.location, "path", input.path);
    if (
      (input.slug !== undefined || input.parentPath !== undefined) &&
      !isPathSegment(slug)
    )
      return invalidSegment(input.location, "slug", slug);
    return {
      path: input.path,
      slug: isPathSegment(slug) ? slug : input.path.split("/").at(-1)!,
      index,
    };
  }
  if (!isPathSegment(slug))
    return invalidSegment(
      input.location,
      input.slug === undefined && input.parentPath === undefined
        ? "file name"
        : "slug",
      slug,
    );
  if (input.parentPath !== undefined)
    return { path: `${input.parentPath}/${slug}`, slug, index: false };
  const directories = parts.filter(
    (part) => !input.transparent?.includes(part),
  );
  for (const part of directories)
    if (!isPathSegment(part))
      return invalidSegment(input.location, "directory name", part);
  const path = [
    ...(input.prefix ? input.prefix.split("/") : []),
    ...directories,
    ...(index ? [] : [slug]),
  ].join("/");
  if (!path)
    return {
      code: "root-index",
      message: `${input.location} has no folder to be the index of; give it a path`,
    };
  if (!isEntryPath(path)) return invalidPath(input.location, "path", path);
  return { path, slug, index: input.parentPath === undefined && index };
}

/** Validate authored move hints without consulting any baseline or pairing state. */
export function movedFromDiagnostic(
  value: unknown,
  location: string,
): PathDiagnostic | undefined {
  return value === undefined || isEntryPath(value)
    ? undefined
    : invalidPath(location, "movedFrom", value);
}

/** Format the exact invalid-segment diagnostic. */
export function invalidSegment(
  location: string,
  field: string,
  value: unknown,
): PathDiagnostic {
  return {
    code: "invalid-segment",
    message: `${location}: ${field} ${JSON.stringify(value)} is not a valid path segment; use letters, digits, hyphens and underscores`,
  };
}

/** Format the exact invalid-path diagnostic. */
function invalidPath(
  location: string,
  field: string,
  value: unknown,
): PathDiagnostic {
  return {
    code: "invalid-path",
    message: `${location}: ${field} ${JSON.stringify(value)} is not a valid path`,
  };
}

/** One base rule for links and flow references, including parent-authored variants. */
export function entryLinkBase(
  path: string,
  index: boolean,
  parentBase?: string,
): string {
  return parentBase ?? (index ? path : path.split("/").slice(0, -1).join("/"));
}
