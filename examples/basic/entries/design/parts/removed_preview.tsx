import type { DesignDestination } from "./destinations.js";
import { EmptyState } from "./stage_content.js";

/**
 * The quiet label that sits between the head band and a stage holding content
 * from before the entry was removed.
 */
export function PreviousVersionLabel() {
  return <p className="mbk-previous">Showing previous version</p>;
}

/** The stage while the previous version is still being retrieved. */
export function PreviewLoading() {
  return (
    <div className="mbk-preview-state">
      <div className="mbk-preview-status" role="status">
        <span className="mbk-preview-spinner" aria-hidden="true" />
        Loading previous version…
      </div>
    </div>
  );
}

/**
 * The stage after the previous version could not be retrieved. Retry repeats
 * the request, so it returns to the loaded preview in this catalogue.
 */
export function PreviewUnavailable({ to }: { to: DesignDestination }) {
  return (
    <EmptyState
      body="The previous version could not be loaded."
      linkLabel="Retry"
      title="Previous version unavailable"
      to={to}
    />
  );
}
