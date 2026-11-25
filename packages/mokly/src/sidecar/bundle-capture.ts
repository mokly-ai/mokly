import type { build } from "esbuild";

import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";

import type { CaptureDurability } from "./capture-durability.js";
import { metadataRuntime } from "./metadata-proof.js";
import type { ResolutionEvidence } from "./resolution-evidence.js";
import type { ServeEditImports } from "./serve-edit-imports.js";
import type { StorybookMainCache } from "./storybook-main.js";

export interface BundleCaptureState {
  started: bigint;
  mode: BundleCapture;
  reads: Map<string, Uint8Array>;
  durability?: CaptureDurability | undefined;
  evidence?: ResolutionEvidence;
  previews?: ReadonlyMap<string, string> | undefined;
  mains?: StorybookMainCache;
  plan?: ResolutionPlan;
  editImports?: ServeEditImports;
  guardedCompile?: typeof build | undefined;
}

/** Keep the same inputs across both native and planned compile attempts. */
export function startCapture(
  mode: BundleCapture,
  durability?: CaptureDurability,
  guardedCompile?: typeof build,
): BundleCaptureState {
  return {
    started: metadataRuntime.now(),
    mode,
    reads: new Map(),
    guardedCompile,
    ...(mode === "full" ? { durability } : {}),
  };
}
