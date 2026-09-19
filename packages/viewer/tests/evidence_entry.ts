import type { CatalogueReadModel } from "../src/catalogue/types.js";

import {
  startEvidenceHarness,
  type EvidenceProbe,
} from "./evidence_harness.js";

declare global {
  interface Window {
    evidence: EvidenceProbe;
    startEvidence(
      model: CatalogueReadModel,
      origin: string,
      cross: boolean,
      sibling: "ready" | "pending" | "unavailable",
    ): void;
  }
}

window.startEvidence = (model, origin, cross, sibling) => {
  window.evidence = startEvidenceHarness(model, origin, cross, sibling);
};
