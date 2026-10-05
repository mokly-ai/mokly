/** Demand document composition for accepted HTTP catalogue generations. */
import type { ComponentRuntime } from "../build/component_runtime.js";
import type { CompiledDocument } from "../build/document_compiler.js";
import type { MoveTargetsProvider } from "../build/move_targets.js";

import type { ForegroundActivity } from "./demand/activity.js";
import { DocumentService } from "./demand/service.js";
import type { ServerOptions } from "./http_types.js";

/** Publish accepted usage and watched resources after each demand render. */
export function createHttpDocuments(
  runtime: ComponentRuntime,
  activity: ForegroundActivity,
  moveTargets: MoveTargetsProvider,
  options: Pick<ServerOptions, "onPreviewResources">,
  onDocument: (document: CompiledDocument) => void,
): DocumentService | undefined {
  if (runtime.manifest.schemaVersion !== "live-index-1") return;
  return new DocumentService(runtime, activity.channel(), {
    moveTargets,
    onDocument(document) {
      onDocument(document);
      options.onPreviewResources?.({
        generation: runtime.generation,
        documents: [
          [document.route, document.html],
          ...(document.watchDocuments ?? []),
        ],
      });
    },
  });
}
