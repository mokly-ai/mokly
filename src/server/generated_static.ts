import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";

/** Retain accepted bytes only; request handling never reads generated output from disk. */
export function acceptedGeneratedStatic(
  runtime?: ComponentRuntime,
): ReadonlyMap<string, GeneratedFile> {
  return new Map(runtime ? [...runtime.styleOutputs, ...runtime.outputs] : []);
}
