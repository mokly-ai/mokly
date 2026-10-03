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
): LogicalTarget {
  const sourcePath = sourceRoute.slice(0, sourceRoute.lastIndexOf("/"));
  const source = entries.get(sourcePath);
  let reference: string | undefined;
  if (target.path.startsWith("~definition-")) {
    const definition = [...entries.values()]
      .map((entry) => referencedDefinition(target.path, entry))
      .find((value) => value !== undefined);
    if (definition && definition[DEFINITION_IDENTITY].path === undefined)
      throw new MoklyError(
        "build-invalid",
        `[unknown-link-target] ${source?.location ?? sourceRoute}: referenced definition ${definition.title} from ${definition.definedIn ?? "<unattributed>"} is not exported by an entry module`,
      );
    reference = definition?.[DEFINITION_IDENTITY].path;
  } else reference = resolveLinkPath(target.path, source?.linkBase ?? "");
  if (reference === undefined || !entries.has(reference))
    throw new MoklyError(
      "build-invalid",
      `[unknown-link-target] ${source?.location ?? sourceRoute}: link target ${reference ?? target.path} does not exist`,
    );
  return { ...target, path: reference };
}
