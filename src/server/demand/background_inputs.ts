/** Background compilation inputs never duplicate previously rendered documents. */
import { compactRuntime } from "../../build/compact_runtime.js";
import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedFile } from "../../build/generated_file.js";

interface BackgroundInputs {
  runtime: ComponentRuntime;
  existingManifest?: Compilation["manifest"];
  existingOutputs?: ReadonlyMap<string, GeneratedFile>;
}

/** The parent keeps full adoption output; the worker receives only its required inputs. */
export function backgroundInputs(
  runtime: ComponentRuntime,
  existing?: Compilation,
): BackgroundInputs {
  const outputs = existing?.outputs;
  return {
    runtime: { ...compactRuntime(runtime), outputs: [] },
    ...(existing ? { existingManifest: existing.manifest } : {}),
    ...(outputs ? { existingOutputs: outputs } : {}),
  };
}
