/** Diagnostic phases expose categories only, without authored paths or values. */
export type BundlePhase =
  | "sidecar.bundle.compile"
  | "sidecar.bundle.classify"
  | "sidecar.bundle.graph"
  | "sidecar.bundle.inputs"
  | "sidecar.bundle.resolution";

export interface Measurements {
  run<T>(phase: BundlePhase, work: () => Promise<T>): Promise<T>;
  runSync<T>(phase: BundlePhase, work: () => T): T;
}

export const unmeasured: Measurements = {
  run: (_phase, work) => work(),
  runSync: (_phase, work) => work(),
};
