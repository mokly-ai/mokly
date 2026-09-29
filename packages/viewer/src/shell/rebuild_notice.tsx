/** Watched Serve's last-working-version notice, shell chrome below the top bar. */

import { useEffect, useLayoutEffect, useRef } from "react";

import type { RebuildFailure } from "../client/rebuild_status.js";

import { useViewerLiveState } from "./capability_context.js";
import { AlertIcon, ChevronDownIcon } from "./icons.js";
import { useShellIdentifier } from "./identifier_context.js";
import {
  announcesFailure,
  initialAccountedFailure,
  REBUILD_FAILURE_ANNOUNCEMENT,
  REBUILD_STATUS_COPY,
} from "./rebuild_status_view.js";
import { useShellStore } from "./store_context.js";

/**
 * Present the adopted private status on every standalone route. It stays
 * mounted without a failure, so the failure shown at first paint remains the
 * document's baseline and every later failure id is announced exactly once.
 * A cleared failure also withdraws its announcement if nothing replaced it,
 * so the status region never keeps describing a failure that has gone. The
 * store's actions only enqueue state updates, so the effect follows the
 * failure id alone.
 */
export function RebuildNotice() {
  const status = useViewerLiveState().rebuildStatus;
  const store = useShellStore();
  const accounted = useRef(initialAccountedFailure(status));
  const failureId = status?.failure?.id;
  useEffect(() => {
    if (failureId === undefined) {
      store.withdrawAnnouncement(REBUILD_FAILURE_ANNOUNCEMENT);
      return;
    }
    if (!announcesFailure(accounted.current, failureId)) return;
    accounted.current = failureId;
    store.announce(REBUILD_FAILURE_ANNOUNCEMENT);
  }, [failureId]);
  return status?.failure ? (
    <RebuildNoticeView failure={status.failure} />
  ) : null;
}

/**
 * One failure: a named section with its icon, headline and explanation, and
 * the developer detail behind a native disclosure. The detail is a text node
 * in a focusable, labelled scroll region, never parsed or linkified.
 */
export function RebuildNoticeView({ failure }: { failure: RebuildFailure }) {
  const titleId = useShellIdentifier("mb-rebuild-title");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const shownFailure = useRef(failure.id);
  useLayoutEffect(() => {
    if (shownFailure.current === failure.id) return;
    shownFailure.current = failure.id;
    if (disclosure.current) closeReplacedDetails(disclosure.current);
  }, [failure.id]);
  return (
    <section aria-labelledby={titleId} className="mbk-rebuild">
      <div className="mbk-rebuild-card">
        <span aria-hidden="true" className="mbk-rebuild-icon">
          <AlertIcon size={16} />
        </span>
        <div className="mbk-rebuild-body">
          <div className="mbk-rebuild-copy">
            <h2 id={titleId}>{REBUILD_STATUS_COPY.headline}</h2>{" "}
            <p>{REBUILD_STATUS_COPY.explanation}</p>
          </div>
          <details className="mbk-rebuild-details" ref={disclosure}>
            <summary>
              <span className="mbk-rebuild-label">
                <span className="mbk-rebuild-show">
                  {REBUILD_STATUS_COPY.show}
                </span>
                <span className="mbk-rebuild-hide">
                  {REBUILD_STATUS_COPY.hide}
                </span>
              </span>
              <ChevronDownIcon size={12} />
            </summary>
            <pre
              aria-label={REBUILD_STATUS_COPY.detailRegion}
              className="mbk-rebuild-detail"
              role="region"
              tabIndex={0}
            >
              {failure.detail}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
}

/**
 * A replaced failure closes the local disclosure in place. The element stays
 * mounted, so focus on its control is kept; focus inside the closing detail
 * returns to that control rather than falling back to the document.
 */
function closeReplacedDetails(details: HTMLDetailsElement): void {
  if (!details.open) return;
  const summary = details.querySelector("summary");
  const focused = details.ownerDocument.activeElement;
  if (summary && focused !== summary && details.contains(focused))
    summary.focus({ preventScroll: true });
  details.open = false;
}
