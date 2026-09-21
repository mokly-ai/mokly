/** Compact catalogue identity embedded in static shell pages. */

import type { CatalogueReadModel } from "../catalogue/types.js";

/** Deployment-owned catalogue metadata needed before hydration. */
export interface ExternalCatalogueReference {
  kind: "external";
  path: "/__mokly/catalogue.json";
  identity: string;
  revision: { content: number; evidence: number };
}

/** Describe the shared catalogue used to render one static shell page. */
export function externalCatalogueReference(
  catalogue: CatalogueReadModel,
): ExternalCatalogueReference {
  return {
    kind: "external",
    path: "/__mokly/catalogue.json",
    identity: catalogue.identity.id,
    revision: catalogue.revision,
  };
}

/** Validate an embedded shared-catalogue reference. */
export function readExternalCatalogueReference(
  value: Record<string, unknown>,
): ExternalCatalogueReference {
  const revision = value["revision"];
  if (
    value["kind"] !== "external" ||
    value["path"] !== "/__mokly/catalogue.json" ||
    typeof value["identity"] !== "string" ||
    !/^[a-f0-9]{64}$/.test(value["identity"]) ||
    !isRecord(revision) ||
    !isVersion(revision["content"]) ||
    !isVersion(revision["evidence"])
  )
    throw new Error("Invalid external shell catalogue reference.");
  return {
    kind: "external",
    path: "/__mokly/catalogue.json",
    identity: value["identity"],
    revision: {
      content: revision["content"],
      evidence: revision["evidence"],
    },
  };
}

/** Whether a value selects the external catalogue representation. */
export function isExternalCatalogueReference(
  value: unknown,
): value is Record<string, unknown> & ExternalCatalogueReference {
  return isRecord(value) && value["kind"] === "external";
}

/** Require the fetched catalogue to match the page's accepted snapshot. */
export function catalogueReferenceMatches(
  reference: ExternalCatalogueReference,
  catalogue: CatalogueReadModel,
): boolean {
  return (
    reference.identity === catalogue.identity.id &&
    reference.revision.content === catalogue.revision.content &&
    reference.revision.evidence === catalogue.revision.evidence
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
