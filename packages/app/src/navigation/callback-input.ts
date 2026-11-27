import { installationToConnect } from "./github-flow";
import { connectInstallationPath } from "./paths";

/** The authentication landings whose address arrives carrying provider input. */
export type CallbackLanding =
  "email" | "desktop" | "github-callback" | "github-install";

/** Where a landing's provider input arrives in its address. */
export type CallbackCarrier = "fragment" | "query";

/**
 * Each landing's public route and the part of its address the provider's input
 * arrives in: email links and the desktop app's grant address
 * carry credentials in the fragment, and GitHub returns its values in the
 * query.
 */
export const callbackLandings: Record<
  CallbackLanding,
  { route: string; carrier: CallbackCarrier }
> = {
  email: { route: "/auth/email/callback", carrier: "fragment" },
  desktop: { route: "/auth/desktop/callback", carrier: "fragment" },
  "github-callback": { route: "/auth/github/callback", carrier: "query" },
  "github-install": { route: "/auth/github/install", carrier: "query" },
};

let captured: { landing: CallbackLanding; input: string } | undefined;

function landingAt(pathname: string): CallbackLanding | undefined {
  const path = pathname.replace(/\/+$/, "");
  return (Object.keys(callbackLandings) as CallbackLanding[]).find(
    (landing) => callbackLandings[landing].route === path,
  );
}

/** Keep the landing's own address out of every request its document makes. */
function withholdReferrer(): void {
  if (typeof document === "undefined") return;
  const existing = document.head.querySelector<HTMLMetaElement>(
    'meta[name="referrer"]',
  );
  const policy = existing ?? document.createElement("meta");
  policy.name = "referrer";
  policy.content = "no-referrer";
  if (existing === null) document.head.prepend(policy);
}

/**
 * Take the provider's input off a landing's address before the router reads it.
 *
 * Expo Router records the address it starts on, fragment and query included,
 * and writes that record back once it has mounted, so input still in the
 * address when the router starts returns to it after any later cleanup. This
 * module is therefore the first thing the application entry evaluates. The
 * address keeps its `window.history.state` and gains no history entry. On iOS
 * and Android, `window` has no history, and any location Expo gives it is the
 * app's origin, so nothing is captured there.
 *
 * An installation return without this tab's setup trip behind it has no flow
 * for the landing to finish, so it is not captured at all: its address
 * becomes the connect situation for the installation it names, and the router
 * starts there.
 */
export function captureCallbackInput(): void {
  captured = undefined;
  if (
    typeof window === "undefined" ||
    window.location === undefined ||
    window.history === undefined
  ) {
    return;
  }
  const { pathname, search, hash } = window.location;
  const landing = landingAt(pathname);
  if (landing === undefined) return;
  const inFragment = callbackLandings[landing].carrier === "fragment";
  if (!inFragment) withholdReferrer();
  const toConnect =
    landing === "github-install"
      ? installationToConnect(new URLSearchParams(search))
      : undefined;
  if (toConnect !== undefined) {
    window.history.replaceState(
      window.history.state,
      "",
      connectInstallationPath(toConnect),
    );
    return;
  }
  captured = { landing, input: (inFragment ? hash : search).slice(1) };
  window.history.replaceState(
    window.history.state,
    "",
    inFragment ? pathname + search : pathname,
  );
}

/**
 * The provider input a landing's document arrived with, handed to that landing
 * once. A landing reached any other way — a reload, or a move within the
 * application — has none, which every landing treats as a local refusal.
 */
export function takeCallbackInput(landing: CallbackLanding): URLSearchParams {
  if (captured?.landing !== landing) return new URLSearchParams();
  const input = new URLSearchParams(captured.input);
  captured = undefined;
  return input;
}

captureCallbackInput();
