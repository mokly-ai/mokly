/** Shared unavailable state for a removed entry's previous version. */

import { PREVIEW_UNAVAILABLE } from "../previews/copy.js";

/** Render the unavailable copy and, after a failed request, its Retry action. */
export function PreviewUnavailable(props: { retry: (() => void) | undefined }) {
  return (
    <div className="mbk-stage">
      <div className="mbk-empty">
        <h2>{PREVIEW_UNAVAILABLE.title}</h2>
        <p>{PREVIEW_UNAVAILABLE.body}</p>
        {props.retry ? (
          <button
            className="mbk-empty-link"
            data-mokly-preview-retry=""
            onClick={props.retry}
            type="button"
          >
            {PREVIEW_UNAVAILABLE.retry.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
