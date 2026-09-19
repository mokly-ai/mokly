import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { InstanceRef } from "../src/viewer/types.js";

import {
  type EvidenceFrames,
  startEvidenceHarness,
} from "./evidence_harness.js";

export interface ReadinessProbe {
  readonly events: string[];
  readonly frames: EvidenceFrames;
  readonly instance: InstanceRef;
  readonly mounts: number;
  update(): void;
}

declare global {
  interface Window {
    readiness: ReadinessProbe;
    startReadiness(
      model: CatalogueReadModel,
      origin: string,
      cross: boolean,
      status: "pending" | "unavailable",
    ): void;
  }
}

window.startReadiness = (model, origin, cross, status) => {
  const evidence = startEvidenceHarness(model, origin, cross, status);
  window.readiness = {
    events: evidence.events,
    get frames() {
      return evidence.frames;
    },
    instance: evidence.instance,
    get mounts() {
      return evidence.mounts;
    },
    update() {
      evidence.update("desktop");
    },
  };
};
