import { useId } from "react";

import { AlertIcon, ChevronDownIcon } from "../../parts/icons.js";
import { useDesignStyle } from "../style_context.js";

import type { RebuildNoticeProps } from "./rebuild-notice.js";

/**
 * The approved notice copy. The disclosed detail is developer text and never
 * enters the headline, the explanation or the disclosure label.
 */
const COPY = {
  headline: "Your latest changes couldn’t be loaded.",
  explanation: "You’re seeing the last working version.",
  show: "Show details",
  hide: "Hide details",
} as const;

/**
 * The full-width notice below the top bar: one tinted card with a complete
 * outline and a leading icon, never an edge rail. The native disclosure also
 * works locally, and its visible label names what its state offers.
 */
export function RebuildNoticeView({ detail, open }: RebuildNoticeProps) {
  useDesignStyle("rebuild-notice");
  const heading = useId();
  return (
    <section className="mbk-rebuild" aria-labelledby={heading}>
      <div className="mbk-rebuild-card">
        <span className="mbk-rebuild-icon">
          <AlertIcon size={16} />
        </span>
        <div className="mbk-rebuild-body">
          <div className="mbk-rebuild-copy">
            <h2 id={heading}>{COPY.headline}</h2> <p>{COPY.explanation}</p>
          </div>
          <details className="mbk-rebuild-details" open={open}>
            <summary>
              <span className="mbk-rebuild-label">
                <span className="mbk-rebuild-show">{COPY.show}</span>
                <span className="mbk-rebuild-hide">{COPY.hide}</span>
              </span>
              <ChevronDownIcon size={12} />
            </summary>
            <pre className="mbk-rebuild-detail">{detail}</pre>
          </details>
        </div>
      </div>
    </section>
  );
}
