/** The stage while the routed entry's detail loads, or after its load failed. */

import type { DetailDelivery } from "./data_requests.js";

/** Frames render once the detail arrives; a failure offers one retry. */
export function StageDelivery({
  delivery,
}: {
  delivery: Exclude<DetailDelivery, { status: "ready" }>;
}) {
  if (delivery.status === "loading")
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
    <div className="mbk-empty" data-mokly-stage="" data-viewport="both">
      <p role="alert">This preview couldn’t be loaded.</p>
      <button className="mbk-empty-link" onClick={delivery.retry} type="button">
        Try again
      </button>
    </div>
  );
}
