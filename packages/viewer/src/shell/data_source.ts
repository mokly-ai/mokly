/** The transports one shell root reads its index, details and live state through. */

import type { DetailRequest } from "../catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
  LiveDescriptorV3,
} from "../catalogue/types.js";
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
} from "../components/render_types.js";

/** The index, detail and live transports of one mounted shell. */
export interface ShellDataSource {
  /** Request the index again; an object source answers with its one object. */
  loadIndex(signal: AbortSignal): Promise<CatalogueReadModel>;
  /** Request one entry's detail for the installed index. */
  loadDetail(
    request: DetailRequest,
    index: CatalogueReadModel,
    signal: AbortSignal,
  ): Promise<EntryDetailV2>;
  /**
   * Another deployment replaced the files or another server process answers.
   * The standalone shell performs a full page load; an embedded host is told
   * once and keeps its state.
   */
  deploymentChanged(): void;
  /**
   * Whether `deploymentChanged` replaces the document with a full page load.
   * The stage of such a source keeps loading until the new document arrives.
   */
  readonly reloadsOnDeployment?: boolean;
  /**
   * A detail could not be loaded or accepted; the entry shows its unavailable
   * state with retry. An embedded host is told once per failed load.
   */
  detailFailed?(request: DetailRequest): void;
  /** The live descriptor, event stream and render route of Serve. */
  live?: ShellLiveSource;
}

/** Receives the event stream of one Serve process. */
export interface LiveListener {
  /** One publication: its revision is the message id, its deployment the data. */
  message(revision: number, deploymentId: string): void;
  /** The stream is unavailable; browsing continues without live updates. */
  unavailable(): void;
}

/** The private Serve routes that only the standalone shell reaches. */
export interface ShellLiveSource {
  loadDescriptor(signal: AbortSignal): Promise<LiveDescriptorV3>;
  subscribe(listener: LiveListener): () => void;
  render(
    descriptor: LiveDescriptorV3,
    request: ComponentRenderRequest,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess>;
  /** Whether a received temporary preview document has expired. */
  previewExpired(previewUrl: string, signal: AbortSignal): Promise<boolean>;
}
