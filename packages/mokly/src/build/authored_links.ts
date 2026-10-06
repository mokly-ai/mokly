import {
  isLogicalFragment,
  parseLogicalTarget,
  resolveLinkPath,
  type LogicalTarget,
} from "@mokly/viewer/data";

import { referencedDefinition } from "../authoring/identity.js";
import { DEFINITION_IDENTITY } from "../authoring/markers.js";
import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { MoklyError } from "../errors.js";
import type { EntryMove } from "../review/moves/types.js";

/** Parse authored paths or a private unresolved definition reference. */
export function parseAuthoredLink(value: string): LogicalTarget | undefined {
  const parsed = parseLogicalTarget(value);
  if (parsed) return parsed;
  const match = /^mock:(~definition-[0-9a-f-]{36})(?:#(.*))?$/.exec(value);
  if (!match || (match[2] !== undefined && !isLogicalFragment(match[2])))
    return undefined;
  return {
    path: match[1]!,
    ...(match[2] === undefined ? {} : { fragment: match[2] }),
  };
}

/** Resolve a definition or relative link before emitting public marker metadata. */
export function resolveAuthoredLink(
  target: LogicalTarget,
  sourceRoute: string,
  entries: ReadonlyMap<string, ResolvedRegistryEntry>,
  moves: readonly EntryMove[] = [],
): LogicalTarget {
  const sourcePath = sourceRoute.slice(0, sourceRoute.lastIndexOf("/"));
  const source = entries.get(sourcePath);
  let reference: string | undefined;
  if (target.path.startsWith("~definition-")) {
    const definition = [...entries.values()]
      .map((entry) =>
        entry.kind === "document"
          ? undefined
          : referencedDefinition(target.path, entry),
      )
      .find((value) => value !== undefined);
    if (definition && definition[DEFINITION_IDENTITY].path === undefined)
      throw new MoklyError(
        "build-invalid",
        `[unknown-link-target] ${source?.location ?? sourceRoute}: referenced definition ${definition.title} from ${definition.definedIn ?? "<unattributed>"} is not exported by an entry module`,
      );
    reference = definition?.[DEFINITION_IDENTITY].path;
  } else reference = resolveLinkPath(target.path, source?.linkBase ?? "");
  if (reference === undefined || !entries.has(reference)) {
    const paired = moves.find(
      (move) =>
        move.previousPath.toLowerCase() === reference?.toLowerCase() &&
        entries.get(move.path)?.kind === move.kind,
    );
    const authored = [...entries.values()].find(
      (entry) =>
        entry.movedFrom?.toLowerCase() === reference?.toLowerCase() &&
        reference !== undefined,
    );
    const moved = paired?.path ?? authored?.path;
    throw new MoklyError(
      "build-invalid",
      `[${moved ? "moved-link-target" : "unknown-link-target"}] ${source?.location ?? sourceRoute}: link target ${reference ?? target.path} does not exist${moved ? `; it moved to ${moved}` : ""}`,
    );
  }
  return { ...target, path: reference };
}
