import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/model";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";

import {
  startEvidenceHarness,
  type EvidenceProbe,
} from "./evidence_harness.js";

declare global {
  interface Window {
    evidence: EvidenceProbe;
    startEvidence(
      index: CatalogueReadModel,
      details: readonly (readonly [DetailRequest, EntryDetailV4])[],
      sibling: "ready" | "pending" | "unavailable",
    ): void;
  }
}

// The evidence cases check the viewer, so they mount the same-origin adapter
// over the host's own origin.
window.startEvidence = (index, details, sibling) => {
  window.evidence = startEvidenceHarness(
    index,
    details,
    location.origin,
    false,
    sibling,
  );
};
