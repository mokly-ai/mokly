import type {
  ManifestComponent,
  ManifestComponentVariant,
  ComponentViewRecord,
} from "../components/manifest_types.js";
import type { ColorScheme } from "../data/axes.js";

/** Serializable common metadata for a current manifest entry. */
export interface ManifestEntryBase<Path extends string = string> {
  /** Explicit author declarations; source attribution is derived separately. */
  declaredDependencies: readonly string[];
  description: string;
  path: Path;
  kind: "screen" | "page" | "document" | "use-case" | "component";
  movedFrom?: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  title: string;
}

/** Serializable screen manifest entry. */
export interface ManifestScreen<
  Path extends string = string,
  Reference extends string = Path,
> extends ManifestEntryBase<Path> {
  address?: string;
  colorSchemes: readonly ColorScheme[];
  componentViews?: readonly ComponentViewRecord<Reference>[];
  kind: "screen";
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
  useCasePaths: readonly Reference[];
  /** Parent screen path, present only when this screen is a variant. */
  variantOf?: Reference;
}

/** Serializable whole-document page. */
export interface ManifestPage<
  Path extends string = string,
  _Reference extends string = Path,
> extends ManifestEntryBase<Path> {
  kind: "page";
  tags?: readonly string[];
}

/** Serializable use-case manifest entry. */
export interface ManifestUseCase<
  Path extends string = string,
  Reference extends string = Path,
> extends ManifestEntryBase<Path> {
  kind: "use-case";
  steps: readonly {
    description?: string;
    screenPath: Reference;
    title?: string;
  }[];
  /** Declared classification tags, present only when the entry has them. */
  tags?: readonly string[];
}

/** Any entry emitted by the current manifest writer. */
export type ManifestEntry<
  Path extends string = string,
  Reference extends string = Path,
> =
  | ManifestScreen<Path, Reference>
  | ManifestDocument<Path, Reference>
  | ManifestPage<Path, Reference>
  | ManifestUseCase<Path, Reference>
  | ManifestComponent<Path, Reference>
  | ManifestComponentVariant<Path, Reference>;

/** Current canonical identity-only manifest. */
export interface ManifestV8<
  Path extends string = string,
  Reference extends string = Path,
> {
  entries: readonly ManifestEntry<Path, Reference>[];
  generatedBy: "mokly";
  schemaVersion: 8;
  folders: readonly ManifestFolder[];
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

/** Whole-document entry rendered from Markdown. */
export interface ManifestDocument<
  Path extends string = string,
  _Reference extends string = Path,
> extends ManifestEntryBase<Path> {
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
