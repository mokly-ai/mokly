import type {
  ManifestComponent,
  ManifestComponentVariant,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { ColorScheme } from "../data/axes.js";

/** Serializable common metadata for a current manifest entry. */
export interface ManifestEntryBase {
  description: string;
  id: string;
  kind: "screen" | "page" | "use-case" | "component";
  navPath: readonly string[];
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  title: string;
}

/** Serializable screen manifest entry. */
export interface ManifestScreen extends ManifestEntryBase {
  address?: string;
  colorSchemes: readonly ColorScheme[];
  componentViews?: readonly ComponentViewRecord[];
  kind: "screen";
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
  useCaseIds: readonly string[];
  /** Parent screen id, present only when this screen is a variant. */
  variantOf?: string;
}

/** Serializable whole-document page. */
export interface ManifestPage extends ManifestEntryBase {
  kind: "page";
  tags?: readonly string[];
}

/** Serializable use-case manifest entry. */
export interface ManifestUseCase extends ManifestEntryBase {
  kind: "use-case";
  steps: readonly { description?: string; screenId: string; title?: string }[];
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
}

/** Any entry emitted by the current manifest writer. */
export type ManifestEntry =
  | ManifestScreen
  | ManifestPage
  | ManifestUseCase
  | ManifestComponent
  | ManifestComponentVariant;

/** Current canonical identity-only manifest. */
export interface ManifestV8 {
  entries: readonly ManifestEntry[];
  generatedBy: "mokly";
  schemaVersion: 8;
  sourceFiles: readonly string[];
}

/** A baseline accepted by the historical boundary is exactly manifest v8. */
export type HistoricalManifest = ManifestV8;

/** Historical names express caller intent without introducing a second shape. */
export type HistoricalManifestEntry = ManifestEntry;
export type HistoricalManifestScreen = ManifestScreen;
export type HistoricalManifestPage = ManifestPage;
export type HistoricalManifestUseCase = ManifestUseCase;

/** Current and historical comparison inputs share the exact v8 contract. */
export type Manifest = ManifestV8;
