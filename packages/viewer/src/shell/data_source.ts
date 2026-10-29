/** The transports one shell root reads its index, details and live state through. */

import type { DetailRequest } from "../catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  DeploymentFileV1,
  EntryDetailV4,
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
  ): Promise<EntryDetailV4>;
  /** Request the optional static deployment file. */
  loadDeployment?(signal: AbortSignal): Promise<DeploymentFileV1 | undefined>;
  /**
   * Another deployment replaced the files or another server process answers.
   * The standalone shell performs a full page load; an embedded host is told
   * once, keeps its state, and supplies newer data by replacing `index`. The
   * stage keeps loading until the new data arrives.
   */
  deploymentChanged(): void;
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
