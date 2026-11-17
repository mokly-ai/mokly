import type { ScreenState } from "../../../fixtures/product-states";
import type { AccountIdentity } from "./account-shell";

/** The two logged-out entry screens; every difference between them lives here. */
export type EntryMode = "sign-in" | "sign-up";

/**
 * What one entry screen draws: the four states every screen owns, or a
 * situation these two own beyond them. They are named here rather than added
 * to `ScreenState`, because they belong to this composition alone and every
 * other screen is still checked against the four.
 *
 * Each names the control it is about and what became of it.
 */
export type EntrySituation =
  | ScreenState
  | "github-connecting"
  | "github-refused"
  | "github-opens-soon"
  | "address-refused";

/**
 * Account entry is the logged-out boundary with the public site: the wordmark
 * leaves for the site's home. The switch to the opposite entry screen lives
 * inside the panel, so the header carries nothing.
 */
export const entryCopy = {
  "sign-in": {
    title: "Sign in to Mokly",
    switchCopy: "New to Mokly? ",
    switchLabel: "Create an account",
    switchTo: "product/account/sign-up",
    identity: { kind: "none" } satisfies AccountIdentity,
  },
  "sign-up": {
    title: "Create your account",
    switchCopy: "Already have an account? ",
    switchLabel: "Sign in",
    switchTo: "product/account/sign-in",
    identity: { kind: "none" } satisfies AccountIdentity,
  },
} as const satisfies Record<EntryMode, unknown>;
