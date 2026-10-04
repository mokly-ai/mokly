/** Shared contracts for constructing and routing the interactive listener. */

import type { ViewerInteractiveDescriptor } from "@mokly/viewer/runtime";
import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { DocumentService } from "../server/demand/service.js";

/** Inputs captured only after the app listener has resolved its port. */
export interface InteractiveServerOptions {
  appOrigin?: string;
  appPort: number;
  catalogue: Catalogue;
  documents: DocumentService;
  inspector: Buffer;
  interactiveOrigin?: string;
  onDiagnostic(error: unknown): void;
  onStateChange(descriptor: ViewerInteractiveDescriptor): void;
  port: number;
  runtime: ComponentRuntime;
  strictPort: boolean;
}
