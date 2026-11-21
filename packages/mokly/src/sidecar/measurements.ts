/** Diagnostic phases expose categories only, without authored paths or values. */
export type MeasurementPhase =
  | "sidecar.bundle.compile"
  | "sidecar.bundle.classify"
  | "sidecar.bundle.verify"
  | "sidecar.bundle.verify.classify"
  | "sidecar.bundle.verify.metadata"
  | "sidecar.bundle.verify.current"
  | "sidecar.bundle.verify.observe"
  | "sidecar.bundle.mapped-lookups"
  | "sidecar.bundle.graph"
  | "sidecar.bundle.inputs"
  | "sidecar.bundle.resolution"
  | "sidecar.bundle.metadata"
  | "sidecar.bundle.evidence"
  | "sidecar.bundle.toolchain"
  | "sidecar.bundle.recipe"
  | "sidecar.describe.evaluate"
  | "sidecar.describe.compile"
  | "sidecar.describe.execute"
  | "sidecar.describe.parse-exports"
  | "sidecar.request.decode"
  | "sidecar.response.encode";

export interface Measurements {
  run<T>(phase: MeasurementPhase, work: () => Promise<T>): Promise<T>;
  runSync<T>(phase: MeasurementPhase, work: () => T): T;
}

export const unmeasured: Measurements = {
  run: (_phase, work) => work(),
  runSync: (_phase, work) => work(),
};
