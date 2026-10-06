import type { ResolvedConfig } from "../config/types.js";

import { startCatalogueServer } from "./http.js";
import type { RunningServer, ServerOptions } from "./http_types.js";

/** Server construction seam used by the Serve runtime. */
export interface CatalogueServerFactory {
  start(config: ResolvedConfig, options: ServerOptions): Promise<RunningServer>;
}

/** Node HTTP implementation of the server construction seam. */
export class NodeCatalogueServerFactory implements CatalogueServerFactory {
  start(
    config: ResolvedConfig,
    options: ServerOptions,
  ): Promise<RunningServer> {
    return startCatalogueServer(config, options);
  }
}
