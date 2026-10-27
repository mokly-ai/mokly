/** The stage while the route's details load, or after a route detail fails. */

import type { CatalogueRecord } from "../catalogue/types.js";

import type { DetailDelivery } from "./data_requests.js";

const NOUNS: Readonly<Record<CatalogueRecord["kind"], string>> = {
  component: "component",
  document: "document",
  page: "page",
  screen: "screen",
  "use-case": "user flow",
};

/** Frames render once the detail arrives; a failure offers one retry. */
export function StageDelivery({
  delivery,
  kind,
}: {
  delivery: Exclude<DetailDelivery, { status: "ready" }>;
  kind: CatalogueRecord["kind"];
}) {
  if (delivery.status === "loading" || delivery.status === "replaced")
    return (
      <div
        aria-busy="true"
        className="mbk-empty"
        data-mokly-stage=""
        data-viewport="both"
      >
        <p role="status">Loading preview…</p>
      </div>
    );
  return (
    <div className="mbk-empty" role="alert">
      <h2>{`This ${NOUNS[kind]} could not be shown`}</h2>
      <p>The catalogue is still available while you try again.</p>
      <button className="mbk-empty-link" onClick={delivery.retry} type="button">
        Try again
      </button>
    </div>
  );
}
