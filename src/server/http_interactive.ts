/** Composition boundary for the optional second Serve listener. */

import type { ServerResponse } from "node:http";

import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  NodeInteractiveServerFactory,
  type InteractiveServer,
} from "../interactive/server.js";

import type { DocumentService } from "./demand/service.js";
import type { ServerOptions } from "./http_types.js";

interface StartInteractiveHttpInput {
  appPort: number;
  catalogue: Catalogue;
  clientModules: ReadonlyMap<string, Buffer>;
  config: ResolvedConfig;
  documents?: DocumentService;
  onFailure(): Promise<void>;
  options: ServerOptions;
  runtime?: ComponentRuntime;
  streams: ReadonlySet<ServerResponse>;
}

/** Prefer the adjacent port, or delegate to the OS when no higher port exists. */
export function defaultInteractivePort(appPort: number): number {
  return appPort < 65_535 ? appPort + 1 : 0;
}

/** Require retained Live sources exactly when this server enables Live. */
export function validateInteractiveSources(
  config: ResolvedConfig,
  runtime?: ComponentRuntime,
): void {
  if (!runtime) return;
  const captured = runtime.interactiveSources !== undefined;
  if ((config.interactive === "serve") !== captured)
    throw new MoklyError(
      "server-failed",
      config.interactive === "serve"
        ? "Live runtime is missing its accepted source capture"
        : "non-Live runtime must not retain an interactive source capture",
    );
}

/** Start Live only after the app port resolves, closing app ownership on failure. */
export async function startInteractiveHttp(
  input: StartInteractiveHttpInput,
): Promise<InteractiveServer | undefined> {
  if (input.config.interactive !== "serve") return;
  const inspector = input.clientModules.get("inspector.js");
  if (!input.runtime || !input.documents || !inspector) {
    await input.onFailure();
    throw new MoklyError(
      "server-failed",
      "interactive server requires the current runtime, documents and inspector",
    );
  }
  try {
    return await (
      input.options.interactiveServerFactory ??
      new NodeInteractiveServerFactory()
    ).start({
      ...(input.options.appOrigin
        ? { appOrigin: input.options.appOrigin }
        : {}),
      appPort: input.appPort,
      catalogue: input.catalogue,
      documents: input.documents,
      inspector,
      ...(input.options.interactiveOrigin
        ? { interactiveOrigin: input.options.interactiveOrigin }
        : {}),
      onDiagnostic: input.options.onDiagnostic ?? (() => undefined),
      onStateChange: (descriptor) => {
        const payload = `event: interactive\ndata: ${JSON.stringify(descriptor)}\n\n`;
        for (const stream of input.streams) stream.write(payload);
      },
      port:
        input.options.interactivePort ?? defaultInteractivePort(input.appPort),
      runtime: input.runtime,
      strictPort: input.options.strictPort ?? false,
    });
  } catch (error) {
    await input.onFailure();
    throw error;
  }
}
