/** Exact route dispatcher for the isolated interactive listener. */

import type { IncomingMessage, ServerResponse } from "node:http";

import type { ViewerInteractiveDescriptor } from "@mokly/viewer/runtime";
import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { DocumentService } from "../server/demand/service.js";

import type { InteractiveBundleService } from "./bundle_state.js";
import type { InteractiveBundlePreparation } from "./bundle_state.js";
import {
  interactiveGeneration,
  type InteractiveGeneration,
} from "./generation.js";
import {
  interactiveHeaders,
  sendInteractive,
  sendInteractiveState,
} from "./responses.js";
import { interactiveHost } from "./server_authority.js";
import { serveInteractiveDiagnostic } from "./server_diagnostic.js";
import { serveInteractiveStatic } from "./server_static.js";
import type { InteractiveServerOptions } from "./server_types.js";

/** Mutable request state shared by both Serve origins. */
export class InteractiveRequestRouter {
  private current: InteractiveGeneration | undefined;
  private readonly generations = new Map<string, InteractiveGeneration>();
  private readonly reported = new Set<string>();

  constructor(
    private readonly bundles: InteractiveBundleService,
    private readonly port: number,
    private readonly options: InteractiveServerOptions,
  ) {}

  descriptor(): ViewerInteractiveDescriptor {
    const generation = this.requireCurrent().generation;
    return {
      generation,
      port: this.port,
      state: this.bundles.state(generation) ?? "failed",
      ...(this.options.interactiveOrigin
        ? { origin: this.options.interactiveOrigin }
        : {}),
    };
  }

  async prepare(
    generation: string,
  ): Promise<InteractiveBundlePreparation | undefined> {
    if (generation !== this.current?.generation) return;
    return this.bundles.prepare(generation);
  }

  replace(
    runtime: ComponentRuntime,
    catalogue: Catalogue,
    documents: DocumentService,
  ): void {
    const generation = interactiveGeneration(runtime, catalogue, documents);
    this.current = generation;
    this.generations.set(generation.generation, generation);
    this.bundles.adopt(generation.config, generation.generation);
    while (this.generations.size > 2) {
      const oldest = this.generations.keys().next().value as string | undefined;
      if (!oldest) break;
      this.generations.delete(oldest);
      for (const key of this.reported)
        if (key.startsWith(`${oldest}\0`)) this.reported.delete(key);
    }
  }

  stateChanged(generation: string): void {
    if (generation === this.current?.generation)
      this.options.onStateChange(this.descriptor());
  }

  async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    interactiveHeaders(response);
    const method = request.method ?? "GET";
    try {
      const authority = interactiveHost(
        request,
        this.options.interactiveOrigin,
      );
      if (!authority)
        return sendInteractive(
          response,
          403,
          "text/plain; charset=utf-8",
          "This request is not allowed.",
          method,
        );
      const url = new URL(request.url ?? "/", "http://mokly.invalid");
      if (url.search && !url.pathname.startsWith("/static/"))
        return this.notFound(response, method);
      if (url.pathname === "/__mokly/client/inspector.js")
        return this.inspector(response, method);
      const bundle = bundlePath(url.pathname);
      if (bundle) return this.bundle(response, method, bundle);
      const diagnostics = diagnosticPath(url.pathname);
      if (diagnostics) {
        const context = this.generations.get(diagnostics);
        return await serveInteractiveDiagnostic({
          ...(context ? { context } : {}),
          generation: diagnostics,
          method,
          onDiagnostic: this.options.onDiagnostic,
          reported: this.reported,
          request,
          response,
        });
      }
      if (url.pathname.startsWith("/static/")) {
        if (url.pathname.endsWith(".html"))
          response.setHeader("content-security-policy", this.frameAncestors());
        return await serveInteractiveStatic({
          appPort: this.options.appPort,
          bundles: this.bundles,
          context: this.requireCurrent(),
          frameAncestors: this.frameAncestors(),
          frameOrigin: this.frameOrigin(authority),
          forwarded: this.options.interactiveOrigin !== undefined,
          method,
          response,
          url,
        });
      }
      return this.notFound(response, method);
    } catch (error) {
      this.options.onDiagnostic(error);
      if (!response.destroyed && !response.headersSent)
        sendInteractive(
          response,
          500,
          "text/plain; charset=utf-8",
          "Could not prepare this Live preview.",
          method,
        );
    }
  }

  private inspector(response: ServerResponse, method: string): void {
    if (method !== "GET" && method !== "HEAD")
      return this.methodNotAllowed(response, method);
    sendInteractive(
      response,
      200,
      "text/javascript; charset=utf-8",
      this.options.inspector,
      method,
    );
  }

  private bundle(
    response: ServerResponse,
    method: string,
    generation: string,
  ): void {
    if (method !== "GET" && method !== "HEAD")
      return this.methodNotAllowed(response, method);
    if (!this.bundles.has(generation)) return this.notFound(response, method);
    let state = this.bundles.state(generation);
    if (state === "idle" && generation === this.current?.generation)
      state = this.bundles.start(generation);
    if (state === "building" || state === "idle")
      return sendInteractiveState(
        response,
        503,
        generation,
        "building",
        method,
      );
    if (state === "failed") return this.failed(response, method, generation);
    const code = this.bundles.code(generation);
    if (code === undefined)
      return sendInteractive(
        response,
        500,
        "text/plain; charset=utf-8",
        "Could not prepare this Live preview.",
        method,
      );
    sendInteractive(
      response,
      200,
      "text/javascript; charset=utf-8",
      code,
      method,
    );
  }

  private failed(
    response: ServerResponse,
    method: string,
    generation: string,
  ): void {
    if (this.bundles.failure(generation) === "bundle")
      return sendInteractiveState(response, 503, generation, "failed", method);
    sendInteractive(
      response,
      500,
      "text/plain; charset=utf-8",
      "Could not prepare this Live preview.",
      method,
    );
  }

  private frameAncestors(): string {
    return this.options.interactiveOrigin
      ? "frame-ancestors http: https:"
      : `frame-ancestors http://localhost:${String(this.options.appPort)} http://127.0.0.1:${String(this.options.appPort)}`;
  }

  private frameOrigin(authority: string): string {
    if (
      this.options.interactiveOrigin &&
      new URL(this.options.interactiveOrigin).host === authority
    )
      return this.options.interactiveOrigin;
    return `http://${authority}`;
  }

  private methodNotAllowed(response: ServerResponse, method: string): void {
    sendInteractive(
      response,
      405,
      "text/plain; charset=utf-8",
      "Method not allowed.",
      method,
    );
  }

  private notFound(response: ServerResponse, method: string): void {
    sendInteractive(
      response,
      404,
      "text/plain; charset=utf-8",
      "Not found.",
      method,
    );
  }

  private requireCurrent(): InteractiveGeneration {
    if (!this.current) throw new Error("Live generation is unavailable");
    return this.current;
  }
}

function bundlePath(pathname: string): string | undefined {
  return /^\/__mokly\/interactive\/([a-f0-9]{32})\/bundle\.js$/.exec(
    pathname,
  )?.[1];
}

function diagnosticPath(pathname: string): string | undefined {
  return /^\/__mokly\/interactive\/([a-f0-9]{32})\/diagnostics$/.exec(
    pathname,
  )?.[1];
}
