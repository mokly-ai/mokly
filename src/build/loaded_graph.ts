/** Data retained by consumer graph compilation and accepted generation replay. */
import type { CompatibilityTransformer } from "../compatibility/types.js";
import type { ComponentGraphRenderer } from "../components/render.js";
import type { EntryDiscovery } from "../config/entry_discovery.js";
import type { ResolvedConfig } from "../config/types.js";
import type { ResolvedDocument } from "../documents/load.js";
import type { Renderer } from "../renderer/types.js";

import type { GeneratedFile } from "./generated_file.js";
import type { InteractiveSourceCaptureCandidate } from "./interactive_source_capture.js";

/** Consumer modules loaded in one React-safe esbuild graph. */
export interface LoadedGraph {
  /** Fresh filesystem inventory; a bundle replay uses its already accepted config. */
  discovery?: EntryDiscovery;
  compatibilityTransformer?: CompatibilityTransformer;
  definitions: unknown[];
  documents?: readonly ResolvedDocument[];
  entrySources: readonly string[];
  interactiveSourceCapture?: InteractiveSourceCaptureCandidate;
  sourceFiles: readonly string[];
  renderer: Renderer;
  renderWithComponents: ComponentGraphRenderer;
  /** Per-root generated CSS routes (renderer and entries only). */
  stylesheetRoutes: ReadonlyMap<string, string>;
  /** Non-HTML outputs: CSS and copied stylesheet/document resource bytes. */
  styleOutputs: ReadonlyMap<string, GeneratedFile>;
  /** Authored CSS-pass inputs and assets actually delivered by a root. */
  deliveredStyleSources: readonly string[];
  /** Globbed plugin dependencies monitored for new authored files. */
  postcssWatchDirectories?: ResolvedConfig["postcssWatchDirectories"];
}
