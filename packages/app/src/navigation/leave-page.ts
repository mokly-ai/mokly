import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { unexpectedError } from "../api/errors";
import type { Connection } from "../api/types";

import { storeGitHubFlow } from "./github-flow";
import type { GitHubFlowPurpose } from "./github-flow";

/** A hosted page's URL, or the purpose and API answer for one GitHub trip. */
export type PageTrip =
  [url: string] | [purpose: GitHubFlowPurpose, connection: Connection];

/**
 * How a screen hands this tab to another site at the end of a write, as
 * GitHub's authorization and Stripe's hosted pages need: Write in progress in
 * `docs/protocol/cloud/folio-chrome.md`.
 *
 * The function it returns leaves only while the screen that asks is still
 * shown, so a reader who followed Back or another link while the write ran
 * stays where they went, and it says whether it left. The application renders
 * one route at a time, so a screen is shown exactly while it is mounted. The
 * write runs until the page has left, so a screen that goes while its page is
 * still leaving calls the trip off, and the reader stays where they went.
 *
 * A page that left is gone once the next one loads, so nothing marks the end
 * of the trip. A page the browser brings back from its back-forward cache never
 * unloaded: it returns with the state it had when it left, so `restored` runs
 * and the screen returns to rest.
 *
 * A GitHub trip stores its record after the shown check, in the same step as
 * leaving. An abandoned screen's late answer cannot replace a newer record.
 */
export function useLeavePage(
  restored: () => void,
): (...trip: PageTrip) => boolean {
  const shown = useRef(false);
  // Whether a trip that this screen started is under way: the page is leaving
  // and has not come back from the back-forward cache.
  const leaving = useRef(false);
  const restore = useRef(restored);
  restore.current = restored;
  // The trip's own listener for the page coming back: none until the screen
  // leaves, and removed once the page is back or the screen is gone.
  const listener = useRef<((event: PageTransitionEvent) => void) | undefined>(
    undefined,
  );
  const stopListening = useCallback(() => {
    if (listener.current === undefined) return;
    window.removeEventListener("pageshow", listener.current);
    listener.current = undefined;
  }, []);

  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
      stopListening();
    };
  }, [stopListening]);

  // A screen that goes while its page is leaving calls the trip off, so the
  // reader stays where they went. The stop also ends the page's other loads,
  // so it runs in a layout cleanup: React runs it before it inserts the next
  // screen, and no load of the next screen has started yet.
  useLayoutEffect(
    () => () => {
      if (!leaving.current) return;
      leaving.current = false;
      window.stop();
    },
    [],
  );

  return useCallback(
    (...trip: PageTrip) => {
      if (!shown.current) return false;
      if (trip.length === 2 && !storeGitHubFlow(trip[0], trip[1])) {
        throw unexpectedError();
      }
      const url = trip.length === 1 ? trip[0] : trip[1].authorizeUrl;
      window.location.assign(url);
      leaving.current = true;
      stopListening();
      const comeBack = (event: PageTransitionEvent) => {
        if (!event.persisted) return;
        leaving.current = false;
        stopListening();
        restore.current();
      };
      listener.current = comeBack;
      window.addEventListener("pageshow", comeBack);
      return true;
    },
    [stopListening],
  );
}
