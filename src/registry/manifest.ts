import fs from "node:fs";
import path from "node:path";

import type { ColorScheme, Viewport, ComponentViewRecord } from "@mokly/viewer";
import type { ManifestV5, HistoricalManifest } from "@mokly/viewer/data";
import {
  canonicalJson,
  analyzeHierarchy,
  effectiveColorSchemes,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { componentManifestEntry } from "../components/manifest_build.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError, errorMessage } from "../errors.js";

import { validateManifest } from "./manifest_validation.js";

/** Canonical generated manifest filename. */
export const MANIFEST_NAME = "mokly-manifest.json";

/** Former package manifest filename accepted only from Git history. */
export const FORMER_MANIFEST_NAME = "mokabook-manifest.json";

/** Legacy version 2 manifest filename accepted only during migration. */
export const LEGACY_MANIFEST_NAME = "mockbook-manifest.json";

/** Derive one viewport and color-scheme fragment route from a screen route. */
export function fragmentRoute(
  route: string,
  viewport: Viewport,
  colorScheme: ColorScheme = "light",
): string {
  const schemeSuffix = colorScheme === "dark" ? ".dark" : "";
  return route.replace(/\.html$/, `.${viewport}${schemeSuffix}.html`);
}

/** Create deterministic manifest data from prepared entries and the source inventory. */
export function createManifest(
  entries: readonly ResolvedRegistryEntry[],
  sourceFiles: readonly string[],
  catalogueSchemes: readonly ColorScheme[],
  componentViews: ReadonlyMap<string, ComponentViewRecord> = new Map(),
): ManifestV5 {
  const hierarchy = analyzeHierarchy(entries).hierarchy;
  return {
    entries: entries.map((entry) =>
      toManifestEntry(
        entry,
        catalogueSchemes,
        componentViews,
        hierarchy.ancestorsById
          .get(entry.id)
          ?.map((ancestor) => ancestor.title) ?? [],
      ),
    ),
    generatedBy: "mokly",
    sourceFiles: [
      ...new Set([
        ...sourceFiles,
        ...entries.map((entry) => entry.sourceRelativePath),
      ]),
    ].sort(),
    schemaVersion: 5,
  };
}

/** Serialize the current manifest with canonical object-key ordering. */
export function serializeManifest(manifest: ManifestV5): string {
  return `${canonicalJson(manifest, 2)}\n`;
}

/** Read strictly current schema-v5 canonical output. */
export function readManifest(config: ResolvedConfig): ManifestV5 {
  const canonicalPath = path.join(config.mockupsDir, MANIFEST_NAME);
  const manifest = readManifestFile(canonicalPath);
  config.sourceFiles = manifest.sourceFiles;
  return manifest;
}

/** Select the strict canonical input or the explicitly enabled legacy input. */
export function selectManifestInput(
  canonicalExists: boolean,
  formerExists: boolean,
  allowLegacyV2: boolean,
): { allowV2: boolean; filename: string } {
  if (canonicalExists) {
    return { allowV2: false, filename: MANIFEST_NAME };
  }
  if (formerExists) {
    return { allowV2: false, filename: FORMER_MANIFEST_NAME };
  }
  if (!allowLegacyV2) return { allowV2: false, filename: MANIFEST_NAME };
  return { allowV2: true, filename: LEGACY_MANIFEST_NAME };
}

function readManifestFile(candidate: string): ManifestV5 {
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

/** Validate manifest-shaped JSON and normalize temporary version 2 input. */
export function parseManifest(value: unknown): ManifestV5 {
  return validateManifest(value, false, false) as ManifestV5;
}

/** Read old schemas only at the historical comparison boundary. */
export function parseHistoricalManifest(
  value: unknown,
  allowV2 = false,
): HistoricalManifest {
  return validateManifest(value, allowV2, true);
}

function toManifestEntry(
  entry: ResolvedRegistryEntry,
  catalogueSchemes: readonly ColorScheme[],
  componentViews: ReadonlyMap<string, ComponentViewRecord>,
  navPath: readonly string[],
): ManifestV5["entries"][number] {
  const common = {
    declaredDependencies: [...new Set(entry.dependencies)].sort(),
    dependencies: [
      ...new Set([entry.sourceRelativePath, ...entry.dependencies]),
    ].sort(),
    description: entry.description,
    id: entry.id,
    kind: entry.kind,
    navPath: [...navPath],
    ...(entry.rationale ? { rationale: entry.rationale } : {}),
    relatedDocs: [...entry.relatedDocs],
    sourcePath: entry.sourceRelativePath,
    title: entry.title,
  };
  if (entry.kind === "component")
    return {
      ...componentManifestEntry(
        entry,
        common,
        catalogueSchemes,
        componentViews,
      ),
      declaredDependencies: common.declaredDependencies,
    };
  if (entry.kind === "collection")
    return { ...common, childIds: [...entry.childIds], kind: "collection" };
  if (entry.kind === "page")
    return {
      ...common,
      kind: "page",
      route: entry.route,
      ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
    };
  if (entry.kind === "use-case") {
    return {
      ...common,
      kind: "use-case",
      route: entry.route,
      steps: entry.steps.map((step) => ({ ...step })),
      ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    };
  }
  return {
    ...common,
    ...(entry.address ? { address: entry.address } : {}),
    ...(effectiveColorSchemes(entry, catalogueSchemes).includes("dark")
      ? {
          darkFragments: {
            desktop: fragmentRoute(entry.route, "desktop", "dark"),
            mobile: fragmentRoute(entry.route, "mobile", "dark"),
          },
        }
      : {}),
    fragments: {
      desktop: fragmentRoute(entry.route, "desktop"),
      mobile: fragmentRoute(entry.route, "mobile"),
    },
    kind: "screen",
    ...(componentViews.size
      ? {
          componentViews: ["mobile", "desktop"].flatMap((viewport) =>
            effectiveColorSchemes(entry, catalogueSchemes).map((scheme) =>
              componentViews.get(
                fragmentRoute(entry.route, viewport as Viewport, scheme),
              )!,
            ),
          ),
        }
      : {}),
    route: entry.route,
    ...(entry.tags && entry.tags.length > 0 ? { tags: [...entry.tags] } : {}),
    useCaseIds: [...entry.useCaseIds],
    viewports: ["mobile", "desktop"],
  };
}
