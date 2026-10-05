import { isEntryPath, isPathSegment } from "@mokly/viewer/data";

import { validateRelativeGlobs } from "../config/relative_globs.js";
import { MoklyError } from "../errors.js";

/** Authored folder data retained with its diagnostic and source location. */
export interface FolderRecord {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
  exclude?: readonly string[];
  sourcePath: string;
  location: string;
}

/** Validate either folder carrier without silently dropping unknown fields. */
export function validateFolderRecord(
  value: unknown,
  path: string,
  sourcePath: string,
  location: string,
  directory: boolean,
): FolderRecord {
  const fail = (reason: string): never => {
    throw new MoklyError(
      "build-invalid",
      `[invalid-folder] ${location}: ${reason}`,
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("must be a JSON object");
  const fields = value as Record<string, unknown>;
  const allowed = directory
    ? ["title", "order", "hidden", "exclude"]
    : ["path", "title", "order", "hidden"];
  for (const field of Object.keys(fields))
    if (!allowed.includes(field)) fail(`unknown field ${field}`);
  if ((!directory || path !== "") && !isEntryPath(path))
    throw new MoklyError(
      "build-invalid",
      `[invalid-path] ${location}: path ${JSON.stringify(path)} is not a valid path`,
    );
  if (directory && path === "")
    for (const field of ["title", "hidden"] as const)
      if (field in fields) fail(`${field} is not allowed at the top level`);
  if (
    fields.title !== undefined &&
    (typeof fields.title !== "string" ||
      !fields.title.trim() ||
      fields.title.trim() !== fields.title)
  )
    fail(
      "title must be a nonempty string without leading or trailing whitespace",
    );
  if (fields.hidden !== undefined && typeof fields.hidden !== "boolean")
    fail("hidden must be a boolean");
  if (fields.order !== undefined) {
    if (
      !Array.isArray(fields.order) ||
      !fields.order.every(
        (slug: unknown) => slug === "..." || isPathSegment(slug),
      ) ||
      new Set(fields.order).size !== fields.order.length
    )
      fail(
        'order must be an array of segments with at most one "..." and no duplicates',
      );
    if ((fields.order as string[]).includes("index"))
      fail("order cannot name index");
  }
  if (fields.exclude !== undefined) {
    try {
      validateRelativeGlobs(fields.exclude, "exclude", true);
    } catch {
      fail("exclude must be an array of safe relative globs");
    }
  }
  return {
    path,
    sourcePath,
    location,
    ...(fields.title === undefined ? {} : { title: fields.title as string }),
    ...(fields.order === undefined ? {} : { order: fields.order as string[] }),
    ...(fields.hidden === undefined
      ? {}
      : { hidden: fields.hidden as boolean }),
    ...(fields.exclude === undefined
      ? {}
      : { exclude: fields.exclude as string[] }),
  };
}
