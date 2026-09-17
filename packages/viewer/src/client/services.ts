/** Host-provided private transports; the viewer itself owns no Serve endpoints. */
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
  RenderCapability,
} from "../components/render_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import type { adoptCatalogueRevision } from "./catalogue_updates.js";

export interface ViewerServices {
  requestComponentPreview(
    request: ComponentRenderRequest,
    capability: RenderCapability,
    view: GeneratedComponentView,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess>;
  componentPreviewExpired(
    frame: HTMLIFrameElement,
    previews: Iterable<ComponentRenderSuccess>,
    signal: AbortSignal,
  ): Promise<boolean>;
  workspaceLoader(
    data: WorkspaceData,
    signal: AbortSignal,
    changed: () => void,
  ): (views: readonly GeneratedComponentView[]) => void;
}
const services = new WeakMap<Document, ViewerServices>();
/** Install host capabilities for exactly one root and return an idempotent cleanup. */
export function installViewerServices(
  doc: Document,
  value: ViewerServices,
): () => void {
  services.set(doc, value);
  return () => {
    if (services.get(doc) === value) services.delete(doc);
  };
}
export function viewerServices(doc: Document): ViewerServices | undefined {
  return services.get(doc);
}

/** Load evidence validation only when requested, without delaying reload recovery. */
export async function loadCatalogueRevisionAdopter(): Promise<
  typeof adoptCatalogueRevision
> {
  return (await import("./catalogue_updates.js")).adoptCatalogueRevision;
}
