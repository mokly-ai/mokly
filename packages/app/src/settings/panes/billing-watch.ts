import { useCallback, useEffect, useRef } from "react";

import type { Billing } from "../../api/types";
import { useShellFocus } from "../../navigation/shell-focus";

/** How long the pane waits for the webhook that writes the plan. */
const confirmWindowMs = 30_000;

/** How often it asks again while it waits. */
const confirmIntervalMs = 2_000;

/**
 * Read billing until a read reports Team or the bounded wait for Stripe's
 * webhook ends. Only the webhook writes the plan, so a reader who comes back
 * from Checkout can be ahead of it. `accept` takes every read before the
 * deadline. Answers `true` once a read reports Team, `false` when the wait
 * ends first, and `undefined` when `live` answers `false`. The deadline ends
 * a pending read or pause, and drops late answers. A timely failed read rejects.
 */
export async function readUntilTeam(
  read: () => Promise<Billing>,
  accept: (value: Billing) => void,
  live: () => boolean,
): Promise<boolean | undefined> {
  const deadline = Date.now() + confirmWindowMs;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<undefined>((done) => {
    deadlineTimer = setTimeout(() => done(undefined), confirmWindowMs);
  });
  try {
    for (;;) {
      const value = await Promise.race([read(), expired]);
      if (!live()) return undefined;
      if (value === undefined || Date.now() >= deadline) return false;
      accept(value);
      if (value.plan === "team") return true;
      const paused = await Promise.race([
        new Promise<true>((done) => {
          pauseTimer = setTimeout(() => done(true), confirmIntervalMs);
        }),
        expired,
      ]);
      if (!live()) return undefined;
      if (paused === undefined || Date.now() >= deadline) return false;
    }
  } catch (caught) {
    if (Date.now() >= deadline) return live() ? false : undefined;
    throw caught;
  } finally {
    clearTimeout(deadlineTimer);
    clearTimeout(pauseTimer);
  }
}

/**
 * The Billing pane's reads when the desktop app's window gets focus back.
 * Stripe's pages open in the system browser and return there, so focus is the
 * window's only sign that the reader is back. A plain focus reads once with
 * `reload`. The first focus after the window opened Checkout reads with the
 * bounded wait of `readUntilTeam` instead, without the confirming state, and
 * further focus is ignored while it waits. A failed read in that wait hands
 * over to `reload`, so the pane shows the failure as it shows any other.
 *
 * Answers the call that records that the window opened Checkout. A browser
 * tab is never the shell, so its focus does nothing here.
 */
export function useFocusReads(
  scope: string,
  read: () => Promise<Billing>,
  accept: (value: Billing) => void,
  reload: () => void,
): () => void {
  const latest = useRef({ scope, read, accept, reload });
  useEffect(() => {
    latest.current = { scope, read, accept, reload };
  });
  // The scope the window opened Checkout for, and a count that a new scope
  // or the pane's unmount moves on, which ends the wait in progress.
  const opened = useRef<string | undefined>(undefined);
  const waiting = useRef(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
      waiting.current = false;
    },
    [scope],
  );

  const onFocus = useCallback(() => {
    if (waiting.current) return;
    const now = latest.current;
    if (opened.current !== now.scope) {
      opened.current = undefined;
      now.reload();
      return;
    }
    opened.current = undefined;
    waiting.current = true;
    const run = generation.current;
    const live = () => generation.current === run;
    void readUntilTeam(now.read, (value) => latest.current.accept(value), live)
      .catch(() => {
        if (live()) latest.current.reload();
      })
      .finally(() => {
        if (live()) waiting.current = false;
      });
  }, []);
  useShellFocus(onFocus);

  return useCallback(() => {
    opened.current = latest.current.scope;
  }, []);
}
