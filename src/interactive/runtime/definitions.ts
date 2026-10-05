import {
  DEFINITION_IDENTITY,
  VARIANT_PARENT,
} from "../../authoring/markers.js";
import type { EntryDefinition } from "../../authoring/types.js";
import { collectModuleExports } from "../../registry/export_collection.js";
import {
  deriveEntryPath,
  entryLinkBase,
  type DerivedPath,
} from "../../registry/path_derivation.js";

/** Accepted executable entry root projected without filesystem dependencies. */
export interface InteractiveEntryModule {
  exports: Readonly<Record<string, unknown>>;
  modulePath: string;
  file: string;
  prefix?: string;
  transparent: readonly string[];
}

/** Browser definition with the same identity used by the accepted Node graph. */
export type InteractiveDefinition = EntryDefinition &
  DerivedPath & {
    linkBase: string;
  };

/** Collect every named/default export and apply the shared path derivation rules. */
export function resolveInteractiveDefinitions(
  modules: readonly InteractiveEntryModule[],
): readonly InteractiveDefinition[] {
  const collected = modules.flatMap((module) =>
    collectModuleExports(module.exports, module.modulePath).map((item) => ({
      ...item,
      module,
    })),
  );
  const owners = new Map(collected.map((item) => [item.definition, item]));
  const resolved = new Map<EntryDefinition, InteractiveDefinition>();
  const resolving = new Set<EntryDefinition>();
  const resolve = (definition: EntryDefinition): InteractiveDefinition => {
    const existing = resolved.get(definition);
    if (existing) return existing;
    const owner = owners.get(definition);
    if (!owner || resolving.has(definition))
      throw new Error("Live definition has no accepted entry module.");
    resolving.add(definition);
    const parent = definition[VARIANT_PARENT];
    const parentEntry = parent ? resolve(parent) : undefined;
    const derived = deriveEntryPath({
      file: owner.module.file,
      location: owner.location,
      transparent: owner.module.transparent,
      ...(owner.module.prefix === undefined
        ? {}
        : { prefix: owner.module.prefix }),
      ...(definition.slug === undefined ? {} : { slug: definition.slug }),
      ...(parentEntry || definition.path === undefined
        ? {}
        : { path: definition.path }),
      ...(parentEntry ? { parentPath: parentEntry.path } : {}),
    });
    if ("code" in derived) throw new Error(derived.message);
    Object.assign(definition[DEFINITION_IDENTITY], {
      path: derived.path,
      slug: derived.path.split("/").at(-1)!,
    });
    const entry: InteractiveDefinition = {
      ...definition,
      ...derived,
      linkBase: entryLinkBase(
        derived.path,
        derived.index,
        parentEntry?.linkBase,
      ),
      ...(parentEntry ? { variantOf: parentEntry.path } : {}),
    };
    resolved.set(definition, entry);
    resolving.delete(definition);
    return entry;
  };
  return collected.flatMap(({ definition }) =>
    definition.kind === "folder" ? [] : [resolve(definition)],
  );
}
