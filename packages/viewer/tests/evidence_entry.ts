import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV2,
} from "../src/catalogue/types.js";

import {
  startEvidenceHarness,
  type EvidenceProbe,
} from "./evidence_harness.js";

declare global {
  interface Window {
    evidence: EvidenceProbe;
    startEvidence(
      index: CatalogueReadModel,
      details: readonly (readonly [DetailRequest, EntryDetailV2])[],
      origin: string,
      cross: boolean,
      sibling: "ready" | "pending" | "unavailable",
    ): void;
  }
}

window.startEvidence = (index, details, origin, cross, sibling) => {
  window.evidence = startEvidenceHarness(
    index,
    details,
    origin,
    cross,
    sibling,
  );
};
