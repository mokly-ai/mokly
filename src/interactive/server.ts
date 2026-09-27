/** Isolated loopback HTTP listener for Live preview documents and bundles. */

import http from "node:http";

import type { ViewerInteractiveDescriptor } from "@mokly/viewer/runtime";
import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import { bindTimings } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import type { DocumentService } from "../server/demand/service.js";
import { listenOnAvailablePort } from "../server/ports.js";

import {
  CachedInteractiveBundler,
  EsbuildInteractiveBundleCompiler,
  type InteractiveBundler,
} from "./bundle.js";
import {
  GenerationInteractiveBundles,
  type InteractiveBundlePreparation,
} from "./bundle_state.js";
import { InteractiveRequestRouter } from "./server_router.js";
import type { InteractiveServerOptions } from "./server_types.js";

export type { InteractiveServerOptions } from "./server_types.js";

/** Mutable lifecycle owned beside one catalogue HTTP listener. */
export interface InteractiveServer {
  readonly origin: string;
  readonly port: number;
  close(): Promise<void>;
  descriptor(): ViewerInteractiveDescriptor;
  prepare(
    generation: string,
  ): Promise<InteractiveBundlePreparation | undefined>;
  replace(
    runtime: ComponentRuntime,
    catalogue: Catalogue,
    documents: DocumentService,
  ): void;
}

/** Construction seam for tests and alternate HTTP implementations. */
export interface InteractiveServerFactory {
  start(options: InteractiveServerOptions): Promise<InteractiveServer>;
}

/** Node implementation with one generation-aware in-memory bundle service. */
export class NodeInteractiveServerFactory implements InteractiveServerFactory {
  constructor(private readonly bundler?: InteractiveBundler) {}

  async start(options: InteractiveServerOptions): Promise<InteractiveServer> {
    const lifecycle: { running?: NodeInteractiveServer } = {};
    const bundler =
      this.bundler ??
      new CachedInteractiveBundler(new EsbuildInteractiveBundleCompiler());
    const bundles = new GenerationInteractiveBundles(
      bundler,
      (generation) => lifecycle.running?.stateChanged(generation),
      options.onDiagnostic,
    );
    const server = http.createServer(
      bindTimings(
        (request: http.IncomingMessage, response: http.ServerResponse) => {
          void lifecycle.running?.handle(request, response);
        },
      ),
    );
    await listenOnAvailablePort(server, options.port, options.strictPort);
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new MoklyError(
        "server-failed",
        "interactive server did not expose a TCP address",
      );
    }
    const router = new InteractiveRequestRouter(bundles, address.port, options);
    const running = new NodeInteractiveServer(
      server,
      address.port,
      router,
      options,
    );
    lifecycle.running = running;
    try {
      running.replace(options.runtime, options.catalogue, options.documents);
      return running;
    } catch (error) {
      await running.close().catch(() => undefined);
      throw error;
    }
  }
}

class NodeInteractiveServer implements InteractiveServer {
  readonly origin: string;
  private closing: Promise<void> | undefined;

  constructor(
    private readonly server: http.Server,
    readonly port: number,
    private readonly router: InteractiveRequestRouter,
    options: InteractiveServerOptions,
  ) {
    this.origin =
      options.interactiveOrigin ?? `http://127.0.0.1:${String(port)}`;
  }

  descriptor(): ViewerInteractiveDescriptor {
    return this.router.descriptor();
  }

  prepare(
    generation: string,
  ): Promise<InteractiveBundlePreparation | undefined> {
    return this.router.prepare(generation);
  }

  replace(
    runtime: ComponentRuntime,
    catalogue: Catalogue,
    documents: DocumentService,
  ): void {
    this.router.replace(runtime, catalogue, documents);
  }

  stateChanged(generation: string): void {
    this.router.stateChanged(generation);
  }

  handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    return this.router.handle(request, response);
  }

  async close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = new Promise<void>((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
      this.server.closeAllConnections();
    });
    return this.closing;
  }
}
