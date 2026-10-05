import path from "node:path";

import { minimatch } from "minimatch";

import { isDefinition, isRegisteredDefinition } from "../authoring/identity.js";
import {
  DEFINITION_IDENTITY,
  VARIANT_PARENT,
  UNKNOWN_FIELDS,
} from "../authoring/markers.js";
import type {
  EntryDefinition,
  RegistryDefinition,
  ResolvedRegistryEntry,
} from "../authoring/types.js";
import { removedDependencies, type BuildWarning } from "../build/warnings.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import type { CollectedDefinition } from "./export_collection.js";
import { validateFolderRecord, type FolderRecord } from "./folder_records.js";
import {
  deriveEntryPath,
  entryLinkBase,
  movedFromDiagnostic,
  type DerivedPath,
  type PathDiagnostic,
} from "./path_derivation.js";

/** Resolve source-relative identities before validating relationships or rendering. */
export function resolveDefinitions(
  values: readonly unknown[],
  config: ResolvedConfig,
  onWarning?: (warning: BuildWarning) => void,
): {
  entries: ResolvedRegistryEntry[];
  folders: FolderRecord[];
  diagnostics: PathDiagnostic[];
} {
  const entries: ResolvedRegistryEntry[] = [];
  const folders: FolderRecord[] = [...(config.folderRecords ?? [])];
  const diagnostics: PathDiagnostic[] = [];
  const resolved = new Map<
    EntryDefinition,
    (DerivedPath & { linkBase: string }) | undefined
  >();
  const locations = new Map<EntryDefinition, string>();
  const modules = new Map<EntryDefinition, string>();
  const collected = values.flatMap((value): CollectedDefinition[] => {
    if (value && typeof value === "object" && "definition" in value)
      return [value as CollectedDefinition];
    diagnostics.push({
      code: "invalid-definition",
      message: "<unattributed>: export default is not a Mokly definition",
    });
    return [];
  });
  const byDefinition = new Map<RegistryDefinition, CollectedDefinition[]>();
  for (const item of collected)
    byDefinition.set(item.definition, [
      ...(byDefinition.get(item.definition) ?? []),
      item,
    ]);
  for (const [definition, exports] of byDefinition) {
    if (new Set(exports.map((item) => item.modulePath)).size > 1)
      diagnostics.push({
        code: "duplicate-export",
        message: `definition ${definition.title ?? definition.path} is exported by two entry modules:\n${exports
          .map((item) => item.location)
          .sort()
          .map((location) => `  ${location}`)
          .join("\n")}`,
      });
    if (definition.kind !== "folder") {
      locations.set(definition, exports[0]!.location);
      modules.set(definition, exports[0]!.modulePath);
    }
  }

  const resolve = (
    definition: EntryDefinition,
    location: string,
  ): (DerivedPath & { linkBase: string }) | undefined => {
    if (resolved.has(definition)) return resolved.get(definition);
    resolved.set(definition, undefined);
    const source = path.resolve(
      config.repoRoot,
      modules.get(definition) ?? "<unattributed>",
    );
    const exportedFrom = modules.get(definition) ?? "<unattributed>";
    const owner =
      config.rootByFile && Object.hasOwn(config.rootByFile, exportedFrom)
        ? config.rootByFile[exportedFrom]
        : undefined;
    const root =
      owner === undefined
        ? config.roots.find(
            (candidate) =>
              isInside(candidate.dir, source) &&
              candidate.files.some((glob) =>
                minimatch(
                  toPosixPath(path.relative(candidate.dir, source)),
                  glob,
                  { dot: true },
                ),
              ),
          )
        : config.roots[owner];
    const parent = definition[VARIANT_PARENT];
    if (parent && !modules.has(parent))
      modules.set(parent, modules.get(definition) ?? "<unattributed>");
    const parentIdentity = parent
      ? resolve(parent, locations.get(parent) ?? location)
      : undefined;
    if (parent && !parentIdentity) return undefined;
    if (!root && definition.path === undefined) {
      diagnostics.push({
        code: "invalid-path",
        message: `${location}: entry module is outside roots; give it a path`,
      });
      return undefined;
    }
    const result = deriveEntryPath({
      file: root
        ? toPosixPath(path.relative(root.dir, source))
        : path.basename(source),
      location,
      ...(root?.path === undefined ? {} : { prefix: root.path }),
      transparent: root?.transparent ?? [],
      ...(definition.slug === undefined ? {} : { slug: definition.slug }),
      ...(parentIdentity !== undefined || definition.path === undefined
        ? {}
        : { path: definition.path }),
      ...(parentIdentity === undefined
        ? {}
        : { parentPath: parentIdentity.path }),
    });
    if ("code" in result) {
      diagnostics.push(result);
      return undefined;
    }
    const moveError = movedFromDiagnostic(definition.movedFrom, location);
    if (moveError) diagnostics.push(moveError);
    Object.assign(definition[DEFINITION_IDENTITY], {
      path: result.path,
      slug: result.path.split("/").at(-1)!,
    });
    const identity = {
      ...result,
      linkBase: entryLinkBase(
        result.path,
        result.index,
        parentIdentity?.linkBase,
      ),
    };
    resolved.set(definition, identity);
    return identity;
  };

  for (const exports of byDefinition.values()) {
    const item = exports[0]!;
    const { definition, location } = item;
    if (
      !isDefinition(definition) ||
      !isRegisteredDefinition(definition) ||
      definition.__viaDefine !== true ||
      !definition[DEFINITION_IDENTITY] ||
      typeof definition[DEFINITION_IDENTITY] !== "object" ||
      !["screen", "page", "use-case", "component", "folder"].includes(
        definition.kind,
      )
    ) {
      diagnostics.push({
        code: "invalid-definition",
        message: `${item.modulePath}: export ${item.exportName} is not a Mokly definition`,
      });
      continue;
    }
    const sourceRelativePath = definition.definedIn ?? "<unattributed>";
    if (definition.kind === "folder") {
      if (Object.hasOwn(definition, "dependencies"))
        onWarning?.(removedDependencies(definition.path, "folder"));
      const unknown = definition[UNKNOWN_FIELDS] ?? [];
      if (unknown.length) {
        diagnostics.push(
          ...unknown.map((field) => ({
            code: "invalid-folder",
            message: `${location}: unknown field ${field}`,
          })),
        );
        continue;
      }
      const {
        kind: _kind,
        definedIn: _definedIn,
        __viaDefine: _brand,
        dependencies: _dependencies,
        ...input
      } = definition;
      folders.push(
        validateFolderRecord(
          input,
          definition.path,
          item.modulePath,
          location,
          false,
        ),
      );
      continue;
    }
    const identity = resolve(definition, location);
    if (!identity) continue;
    const parent = definition[VARIANT_PARENT];
    const variantOf = parent ? resolved.get(parent)?.path : undefined;
    entries.push({
      ...definition,
      ...identity,
      ...(variantOf === undefined ? {} : { variantOf }),
      location,
      sourceRelativePath,
      entryRoot: path.resolve(config.repoRoot, item.modulePath),
      sourcePath: path.resolve(config.repoRoot, sourceRelativePath),
    } as ResolvedRegistryEntry);
  }
  return { entries, folders, diagnostics };
}
