import type { build } from "esbuild";

import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";

import type { CaptureDurability } from "./capture-durability.js";
import type { ResolutionEvidence } from "./resolution-evidence.js";
import type { ServeEditImports } from "./serve-edit-imports.js";

/** The capture state that the compile attempts of one bundle share. */
export interface BundleCaptureState {
  started: bigint;
  mode: BundleCapture;
  reads: Map<string, Uint8Array>;
  durability?: CaptureDurability | undefined;
  evidence?: ResolutionEvidence;
  preview?: string | null | undefined;
  plan?: ResolutionPlan;
  editImports?: ServeEditImports;
  guardedCompile?: typeof build | undefined;
}
