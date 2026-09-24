import type {
  ManifestComponent,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { Viewport } from "../data/axes.js";

/** Serializable common metadata for a manifest entry. */
export interface ManifestEntryBase {
  dependencies: readonly string[];
  /** Explicit author declarations in component v4 and current v6 manifests. */
  declaredDependencies?: readonly string[];
  description: string;
  id: string;
  kind: "screen" | "page" | "use-case";
  navPath: readonly string[];
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  title: string;
}

/** Serializable screen manifest entry. */
export interface ManifestScreen extends ManifestEntryBase {
  address?: string;
  componentViews?: readonly ComponentViewRecord[];
  darkFragments?: Record<Viewport, string>;
  fragments: Record<Viewport, string>;
  kind: "screen";
  route: string;
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
  useCaseIds: readonly string[];
  /** Parent screen id, present only when this screen is a variant. */
  variantOf?: string;
  viewports: readonly Viewport[];
}

/** Serializable whole-document page. */
export interface ManifestPage extends ManifestEntryBase {
  kind: "page";
  route: string;
  tags?: readonly string[];
}

/** Serializable use-case manifest entry. */
export interface ManifestUseCase extends ManifestEntryBase {
  kind: "use-case";
  route: string;
  steps: readonly { description?: string; screenId: string; title?: string }[];
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
}

/** Any supported registry entry, including current whole-document pages. */
export type ManifestEntry =
  ManifestScreen | ManifestPage | ManifestUseCase | ManifestComponent;

/** One generated legacy page. */
export interface ManifestLegacyPage {
  route: string;
  sourcePath: string;
}

/** Canonical generated catalogue schema. */
export interface ManifestV3 {
  entries: readonly Exclude<ManifestEntry, ManifestComponent | ManifestPage>[];
  generatedBy: "mokly";
  legacyPages: readonly ManifestLegacyPage[];
  schemaVersion: 3;
}

/** Historical whole-document format from the page migration branch. */
export interface ManifestPagesV4 {
  entries: readonly Exclude<ManifestEntry, ManifestComponent>[];
  generatedBy: "mokly";
  schemaVersion: 4;
  sourceFiles: readonly string[];
}

/** Component-aware manifests require complete usage on every screen view. */
export interface ManifestScreenV4 extends ManifestScreen {
  declaredDependencies: readonly string[];
  componentViews: readonly ComponentViewRecord[];
}
export interface ManifestV4 {
  entries: readonly ManifestEntryV4[];
  generatedBy: "mokly";
  legacyPages: readonly ManifestLegacyPage[];
  schemaVersion: 4;
}

export type ManifestEntryV4 = (
  ManifestScreenV4 | ManifestComponent | ManifestUseCase
) & { declaredDependencies: readonly string[] };

/** Historical v5 catalogue combining pages, components, and source protection. */
export interface ManifestV5 {
  entries: readonly (ManifestEntry & {
    declaredDependencies: readonly string[];
  })[];
  generatedBy: "mokly";
  schemaVersion: 5;
  sourceFiles: readonly string[];
}

/** Current canonical manifest with only routed entries and authored paths. */
export interface ManifestV6 {
  entries: readonly (ManifestEntry & {
    declaredDependencies: readonly string[];
  })[];
  generatedBy: "mokly";
  schemaVersion: 6;
  sourceFiles: readonly string[];
}

/** All validated formats accepted at the historical Git boundary. */
export type Manifest =
  ManifestV3 | ManifestV4 | ManifestPagesV4 | ManifestV5 | ManifestV6;

/** Historical comparisons accept older formats without weakening current loading. */
export type HistoricalManifest = Manifest;
