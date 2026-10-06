import type {
  ExportedHandler,
  Request as WorkerRequest,
  Response as WorkerResponse,
} from "@cloudflare/workers-types";

import { createCacheHandler } from "./artifacts.js";
import type { CacheBindings } from "./auth.js";
import { R2ArtifactStore } from "./r2.js";
import type { BucketBinding } from "./r2.js";

interface WorkerBindings extends CacheBindings {
  ARTIFACTS: BucketBinding;
}

export default {
  async fetch(
    request: WorkerRequest,
    bindings: WorkerBindings,
  ): Promise<WorkerResponse> {
    const handle = createCacheHandler(
      new R2ArtifactStore(bindings.ARTIFACTS),
      bindings,
    );
    return (await handle(
      request as unknown as Request,
    )) as unknown as WorkerResponse;
  },
} satisfies ExportedHandler<WorkerBindings>;
