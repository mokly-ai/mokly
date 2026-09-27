import type {
  HistoricalManifestComponent,
  HistoricalManifestComponentVariant,
  ManifestComponent,
  ManifestComponentVariant,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

/** Serializable common metadata for a current manifest entry. */
export interface ManifestEntryBase {
  /** Explicit author declarations; source attribution is derived separately. */
  declaredDependencies: readonly string[];
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
export interface ManifestV7 {
  entries: readonly ManifestEntry[];
  generatedBy: "mokly";
  schemaVersion: 7;
  sourceFiles: readonly string[];
}

/** One historical rendered view after stored paths have been normalized. */
export interface HistoricalArtifactView {
  colorScheme: ColorScheme;
  path: string;
  usage?: ComponentViewRecord;
  viewport: Viewport;
}

/** Common metadata retained at the historical-manifest boundary. */
export interface HistoricalManifestEntryBase extends Omit<
  ManifestEntryBase,
  "kind"
> {
  dependencies: readonly string[];
  kind: ManifestEntryBase["kind"];
}

/** Normalized historical screen with its actual stored or derived artifacts. */
export interface HistoricalManifestScreen extends HistoricalManifestEntryBase {
  address?: string;
  artifacts: readonly HistoricalArtifactView[];
  colorSchemes: readonly ColorScheme[];
  kind: "screen";
  tags?: readonly string[];
  useCaseIds: readonly string[];
  variantOf?: string;
}

/** Normalized historical page with its actual stored or derived document. */
export interface HistoricalManifestPage extends HistoricalManifestEntryBase {
  artifactPath: string;
  kind: "page";
  tags?: readonly string[];
}

/** Normalized historical use case. */
export interface HistoricalManifestUseCase extends HistoricalManifestEntryBase {
  kind: "use-case";
  steps: readonly { description?: string; screenId: string; title?: string }[];
  tags?: readonly string[];
}

/** Any normalized entry accepted from Git history. */
export type HistoricalManifestEntry =
  | HistoricalManifestScreen
  | HistoricalManifestPage
  | HistoricalManifestUseCase
  | HistoricalManifestComponent
  | HistoricalManifestComponentVariant;

/** One legacy unregistered page retained only for historical migration reads. */
export interface HistoricalLegacyPage {
  artifactPath: string;
  sourcePath: string;
}

/** Internal normalized historical manifest shared by comparison readers. */
export interface HistoricalManifest {
  entries: readonly (HistoricalManifestEntry | ManifestEntry)[];
  generatedBy: "mokly";
  legacyPages?: readonly HistoricalLegacyPage[];
  schemaVersion: 3 | 4 | 5 | 6 | 7;
  sourceFiles?: readonly string[];
}

/** Current or normalized historical manifest accepted by comparison logic. */
export type Manifest = ManifestV7 | HistoricalManifest;
