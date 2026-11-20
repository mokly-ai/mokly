/** The two logged-out entry screens; every difference between them lives here. */
export type EntryMode = "sign-in" | "sign-up";

/**
 * What each entry screen says, in a browser tab and in the desktop app's
 * window alike. The window draws only the title, because the browser page it
 * opens offers every way in.
 */
export const entryCopy = {
  "sign-in": {
    title: "Sign in to Mokly",
    documentTitle: "Sign in",
    switchCopy: "New to Mokly? ",
    switchLabel: "Create an account",
    switchTo: "/sign-up",
  },
  "sign-up": {
    title: "Create your account",
    documentTitle: "Create your account",
    switchCopy: "Already have an account? ",
    switchLabel: "Sign in",
    switchTo: "/sign-in",
  },
} as const satisfies Record<
  EntryMode,
  {
    title: string;
    documentTitle: string;
    switchCopy: string;
    switchLabel: string;
    switchTo: string;
  }
>;
