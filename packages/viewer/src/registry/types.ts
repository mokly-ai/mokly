import type {
  ManifestComponent,
  ManifestComponentVariant,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { ColorScheme } from "../data/axes.js";

/** Serializable common metadata for a current manifest entry. */
export interface ManifestEntryBase {
  description: string;
  path: string;
  kind: "screen" | "page" | "document" | "use-case" | "component";
  movedFrom?: string;
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
  useCasePaths: readonly string[];
  /** Parent screen path, present only when this screen is a variant. */
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
  steps: readonly {
    description?: string;
    screenPath: string;
    title?: string;
  }[];
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
}

/** Any entry emitted by the current manifest writer. */
export type ManifestEntry =
  | ManifestScreen
  | ManifestDocument
  | ManifestPage
  | ManifestUseCase
  | ManifestComponent
  | ManifestComponentVariant;

/** Current canonical identity-only manifest. */
export interface ManifestV9 {
  assetClosure: readonly string[];
  blobHashAlgorithm: "sha1" | "sha256";
  generatedFiles: readonly { path: string; blobHash: string }[];
  entries: readonly ManifestEntry[];
  generatedBy: "mokly";
  schemaVersion: 9;
  folders: readonly ManifestFolder[];
  sourceFiles: readonly string[];
}

/** A baseline accepted by the historical boundary is exactly manifest v9. */
export type HistoricalManifest = ManifestV9;

/** Historical names express caller intent without introducing a second shape. */
export type HistoricalManifestEntry = ManifestEntry;
export type HistoricalManifestScreen = ManifestScreen;
export type HistoricalManifestPage = ManifestPage;
export type HistoricalManifestUseCase = ManifestUseCase;

/** Current and historical comparison inputs share the exact v9 contract. */
export type Manifest = ManifestV9;

/** Whole-document entry rendered from Markdown. */
export interface ManifestDocument extends ManifestEntryBase {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
  resources: readonly string[];
  tags?: readonly string[];
}
/** Authored folder metadata; resolved titles remain derived. */
export interface ManifestFolder {
  path: string;
  title?: string;
  order?: readonly string[];
  hidden?: boolean;
  exclude?: readonly string[];
  sourcePath: string;
}
