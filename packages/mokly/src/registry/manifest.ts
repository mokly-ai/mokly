import fs from "node:fs";
import path from "node:path";

import type { ColorScheme, ComponentViewRecord } from "@mokly/viewer";
import type { ManifestV8, HistoricalManifest } from "@mokly/viewer/data";
import {
  canonicalJson,
  effectiveColorSchemes,
  viewRoute,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  componentManifestEntry,
  componentVariantManifestEntry,
} from "../components/manifest_build.js";
import {
  isComponentVariantDefinition,
  type ComponentDefinition,
} from "../components/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";

import type { FolderRecord } from "./folder_records.js";
import { validateManifest } from "./manifest_validation.js";

/** Canonical generated manifest filename. */
export const MANIFEST_NAME = "mokly-manifest.json";

/** Earlier manifest names retained only as incompatibility sentinels and stale output. */
export const EARLIER_MANIFEST_NAMES = [
  "mokabook-manifest.json",
  "mockbook-manifest.json",
] as const;

/** Create deterministic manifest data from prepared entries and the source inventory. */
export function createManifest(
  entries: readonly ResolvedRegistryEntry[],
  sourceFiles: readonly string[],
  catalogueSchemes: readonly ColorScheme[],
  componentViews: ReadonlyMap<string, ComponentViewRecord> = new Map(),
  folders: readonly FolderRecord[] = [],
): ManifestV8 {
  return {
    entries: entries.map((entry) =>
      toManifestEntry(entry, catalogueSchemes, componentViews, entries),
    ),
    folders: [...folders]
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map(({ location: _location, ...record }) => record),
    generatedBy: "mokly",
    sourceFiles: [
      ...new Set([
        ...sourceFiles,
        ...entries.map((entry) => entry.sourceRelativePath),
        ...folders.map((folder) => folder.sourcePath),
      ]),
    ].sort(),
    schemaVersion: 8,
  };
}

/** Serialize the current manifest with canonical object-key ordering. */
export function serializeManifest(manifest: ManifestV8): string {
  return `${canonicalJson(manifest, 2)}\n`;
}

/** Read strictly current schema-v8 canonical output. */
export function readManifest(config: ResolvedConfig): ManifestV8 {
  const canonicalPath = path.join(config.mockupsDir, MANIFEST_NAME);
  const manifest = readManifestFile(canonicalPath);
  config.sourceFiles = manifest.sourceFiles;
  return manifest;
}

function readManifestFile(candidate: string): ManifestV8 {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(candidate, "utf8"));
  } catch (error) {
    throw new MoklyError(
      "manifest-invalid",
      `could not read ${candidate}: ${errorMessage(error)}`,
      {
        cause: error,
      },
    );
  }
  return parseManifest(value);
}

/** Validate manifest-shaped JSON against the current v8 contract. */
export function parseManifest(value: unknown): ManifestV8 {
  return validateManifest(value);
}

/** Apply the earlier/newer version gate, then fully validate historical v8. */
export function parseHistoricalManifest(value: unknown): HistoricalManifest {
  return validateManifest(value, true);
}

function toManifestEntry(
  entry: ResolvedRegistryEntry,
  catalogueSchemes: readonly ColorScheme[],
  componentViews: ReadonlyMap<string, ComponentViewRecord>,
  entries: readonly ResolvedRegistryEntry[],
): ManifestV8["entries"][number] {
  const common = {
    declaredDependencies: [...new Set(entry.dependencies)].sort(),
    description: entry.description,
    path: entry.path,
    kind: entry.kind,
    ...(entry.movedFrom === undefined ? {} : { movedFrom: entry.movedFrom }),
    ...(entry.rationale ? { rationale: entry.rationale } : {}),
    relatedDocs: [...entry.relatedDocs],
    sourcePath: entry.sourceRelativePath,
    title: entry.title,
  };
  if (entry.kind === "component" && isComponentVariantDefinition(entry)) {
    const parent = entries.find(
      (candidate): candidate is ComponentDefinition & ResolvedRegistryEntry =>
        candidate.kind === "component" &&
        !isComponentVariantDefinition(candidate) &&
        candidate.path === entry.variantOf,
    )!;
    return componentVariantManifestEntry(
      entry,
      parent,
      common,
      catalogueSchemes,
      componentViews,
    );
  }
  if (entry.kind === "component")
    return {
      ...componentManifestEntry(entry, common, catalogueSchemes),
      declaredDependencies: common.declaredDependencies,
    };
  if (entry.kind === "document")
    return {
      ...common,
      kind: "document",
      colorSchemes: [...catalogueSchemes],
      resources: [...entry.resources],
      ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
    };
  if (entry.kind === "page")
    return {
      ...common,
      kind: "page",
      ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
    };
  if (entry.kind === "use-case") {
    return {
      ...common,
      kind: "use-case",
      steps: entry.steps.map((step) => ({ ...step })),
      ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    };
  }
  const colorSchemes = effectiveColorSchemes(entry, catalogueSchemes);
  return {
    ...common,
    ...(entry.address ? { address: entry.address } : {}),
    colorSchemes: [...colorSchemes],
    kind: "screen",
    ...(componentViews.size
      ? {
          componentViews: ["mobile", "desktop"].flatMap((viewport) =>
            colorSchemes.map((scheme) =>
              componentViews.get(
                viewRoute(entry.path, viewport as "desktop" | "mobile", scheme),
              )!,
            ),
          ),
        }
      : {}),
    ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    useCasePaths: [...entry.useCasePaths],
    ...(entry.variantOf !== undefined ? { variantOf: entry.variantOf } : {}),
  };
}
