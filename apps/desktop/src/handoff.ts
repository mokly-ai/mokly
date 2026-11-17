import { DESKTOP_ORIGIN } from "./origin.js";

/** Accept one exact scheme form, with no URL normalization or extra fields. */
export function handoffToken(address: string): string | undefined {
  return /^mokly:\/\/auth\/email\/callback#token=([0-9a-f]{64})$/.exec(
    address,
  )?.[1];
}

export interface HandoffWindow {
  load(url: string): Promise<unknown>;
  focus(): void;
}

export interface HandoffExchange {
  started(requestId: number): void;
  settled(requestId: number): void;
}

interface PendingHandoff {
  phase: "reset" | "loading" | "landing";
  requestId?: number;
}

/** Keep repeated presses inert and keep a running exchange in its document. */
export function createHandoff(dependencies: {
  window(): HandoffWindow;
  warn(error: unknown): void;
}) {
  const received = new Set<string>();
  let pending: PendingHandoff | undefined;
  const load = async (
    window: HandoffWindow,
    token: string,
    attempt: PendingHandoff,
  ) => {
    // A fragment-only load reuses the old landing and cannot capture a new token.
    await window.load("about:blank");
    attempt.phase = "loading";
    await window.load(`${DESKTOP_ORIGIN}/auth/email/callback#token=${token}`);
  };
  return {
    receive(address: string): boolean {
      const token = handoffToken(address);
      if (!token || received.has(token) || pending) return false;
      const window = dependencies.window();
      received.add(token);
      const attempt: PendingHandoff = { phase: "reset" };
      pending = attempt;
      window.focus();
      void load(window, token, attempt).catch((error) => {
        if (pending === attempt) pending = undefined;
        dependencies.warn(error);
      });
      return true;
    },
    started(requestId: number): void {
      if (pending?.phase === "landing") pending.requestId = requestId;
    },
    settled(requestId: number): void {
      if (pending?.phase === "landing" && pending.requestId === requestId)
        pending = undefined;
    },
    /** The renderer clears the fragment immediately, but remains on the landing until settled. */
    navigated(address: string): void {
      if (pending?.phase === "reset" || address === "about:blank") return;
      try {
        const landing = new URL(address).pathname === "/auth/email/callback";
        if (pending?.phase === "loading") {
          if (landing) pending.phase = "landing";
        } else if (!landing) pending = undefined;
      } catch {
        /* An invalid address cannot finish an exchange. */
      }
    },
  };
}

/** A CORS preflight cannot release the guard while its POST is still pending. */
export function exchangeObserver(
  settled: (requestId: number) => void,
): (request: { method: string; id: number }) => void {
  return ({ method, id }) => {
    if (method === "POST") settled(id);
  };
}
