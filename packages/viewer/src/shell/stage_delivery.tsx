/**
 * The stage while the route's details load, or after one route detail fails.
 * `@mokly/ui/preview-state` draws both states.
 */

import type { CatalogueRecord } from "@mokly/model";
import { StageFailure, StageLoading } from "@mokly/ui/preview-state";

import type { DetailDelivery } from "./data_requests.js";
import type { RetryFocus } from "./retry_focus.js";

const NOUNS: Readonly<Record<CatalogueRecord["kind"], string>> = {
  component: "component",
  document: "document",
  page: "page",
  screen: "screen",
  "use-case": "user flow",
};

/**
 * Frames render once the route's details arrive; a failure offers one retry.
 * After Try again, focus moves to the loading state, then to the content.
 */
export function StageDelivery({
  delivery,
  focus,
  kind,
}: {
  delivery: Exclude<DetailDelivery, { status: "ready" }>;
  focus: RetryFocus;
  kind: CatalogueRecord["kind"];
}) {
  if (delivery.status === "loading" || delivery.status === "replaced")
    return <StageLoading focusRef={focus.status} />;
  return (
    <StageFailure noun={NOUNS[kind]} onRetry={focus.retry(delivery.retry)} />
  );
}
