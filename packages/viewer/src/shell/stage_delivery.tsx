/**
 * The stage while the route's details load, or after one route detail fails.
 * `@mokly/ui/preview-state` draws both states.
 */

import { StageFailure, StageLoading } from "@mokly/ui/preview-state";

import type { CatalogueRecord } from "../catalogue/types.js";

import type { DetailDelivery } from "./data_requests.js";

const NOUNS: Readonly<Record<CatalogueRecord["kind"], string>> = {
  component: "component",
  document: "document",
  page: "page",
  screen: "screen",
  "use-case": "user flow",
};

/** Frames render once the route's details arrive; a failure offers one retry. */
export function StageDelivery({
  delivery,
  kind,
}: {
  delivery: Exclude<DetailDelivery, { status: "ready" }>;
  kind: CatalogueRecord["kind"];
}) {
  if (delivery.status === "loading" || delivery.status === "replaced")
    return <StageLoading />;
  return <StageFailure noun={NOUNS[kind]} onRetry={delivery.retry} />;
}
