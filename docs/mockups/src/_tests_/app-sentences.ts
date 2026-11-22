import type { ScreenId } from "./app-owners";

/** A sentence written directly or reached through one named shared constant. */
export type SentenceDeclaration =
  string | { sentence: string; constant: { file: string; name: string } };

/**
 * Exact sentences whose parity matters beyond controls, options and titles.
 *
 * The label comparison reads buttons, segmented options and state titles, and
 * three of the Billing pane's pages draw none of them: the landing Checkout
 * returns to says only what it is doing, the admin's reading answers with a
 * sentence rather than an action, and a deployment with no billing configured
 * says the one thing it knows. A page with nothing to compare is a gap rather
 * than a pass, so each names the sentences it draws instead, and the suite
 * holds both the drawn page and the owning source to them. A page may also
 * name essential prose beside a title, as the admin's Free plan, the
 * unsupported-lockfile build's line, the plan refusal's line for everyone but
 * an owner, a reviewer's queued build's line and the fork card's line do. It
 * may also name the heading of an account panel, which no control, option or
 * state title carries. The install step read by a member or a reviewer draws
 * no control at all, and the GitHub installation landings say their outcome in
 * a heading and a line.
 * The GitHub accounts pane read by a member draws no control either, so it is
 * compared by the heading its accounts sit under.
 */
export const sentences: Partial<
  Record<ScreenId, readonly SentenceDeclaration[]>
> = {
  "product/settings/billing/confirming": ["Confirming your subscription"],
  "product/settings/billing/admin": [
    {
      sentence: "An owner manages billing.",
      constant: { file: "api/labels.ts", name: "ownerManagesBilling" },
    },
  ],
  "product/settings/billing/admin-free": [
    {
      sentence: "An owner manages billing.",
      constant: { file: "api/labels.ts", name: "ownerManagesBilling" },
    },
  ],
  "product/settings/billing/unavailable": ["Billing opens soon."],
  "product/settings/sections/mac-app": [
    "Your name, email and GitHub connection",
  ],
  "product/settings/project/no-builds": [
    {
      sentence: "This project publishes from CI.",
      constant: { file: "api/labels.ts", name: "publishesFromCi" },
    },
  ],
  "product/viewer/standalone/build/lockfile": [
    "Mokly installs with npm, pnpm or Yarn.",
  ],
  "product/viewer/standalone/build/reader/plan": [
    {
      sentence: "Ask an owner to upgrade to Team.",
      constant: { file: "api/labels.ts", name: "askAnOwnerToUpgrade" },
    },
  ],
  "product/viewer/standalone/build/reader/queued": ["Waiting to start."],
  "product/viewer/pull-request/fork": [
    "Review this pull request’s screens locally.",
  ],
  // The install step for a member and for a reviewer draws no control, so its
  // heading and line are the page; a member keeps the way to the CLI form,
  // which the repository step's own drawings say too.
  "product/account/install-app/member": [
    "Install the Mokly app",
    "Ask an owner or admin to install it.",
    "Publish with the CLI instead",
  ],
  "product/account/install-app/reviewer": [
    "No projects yet",
    "Ask an owner or admin to create the first project.",
  ],
  "product/account/choose-repository/open": ["Publish with the CLI instead"],
  "product/account/choose-repository/one-account": [
    "Publish with the CLI instead",
  ],
  "product/account/choose-repository/slug-taken": [
    "Publish with the CLI instead",
  ],
  "product/account/callback/install-requested": [
    "Installation requested",
    "An owner of the GitHub organization approves it on GitHub.",
  ],
  "product/account/callback/install-conflict": [
    "This GitHub account is connected to another workspace",
    "Remove it from that workspace first.",
  ],
  "product/account/callback/install-denied": [
    "You don’t administer this GitHub account",
  ],
  "product/settings/github/member": ["Connected accounts"],
  // The GitHub accounts fact's failed read says so beside its quiet retry,
  // and so does the install step's suspension whose link could not be read.
  "product/settings/workspace/accounts-unreadable": ["Couldn’t load"],
  "product/account/install-app/suspended-unreadable": ["Couldn’t load"],
  // The route's project read names itself in the frame's heading, for screen
  // readers, and the stage it answers for draws only placeholders.
  "product/viewer/standalone/project-loading": ["Opening your project"],
};

/**
 * Sentences deliberately removed from a drawing. Each must stay out of both the
 * generated page and the source that owns the running screen, whether that
 * source writes the sentence or reaches for the constant that holds it. A
 * sentence with no shared home is declared as itself.
 */
export const droppedSentences: Partial<
  Record<ScreenId, readonly SentenceDeclaration[]>
> = {
  "product/account/project-created": [
    {
      sentence: "Projects are public on the free plan.",
      constant: { file: "api/labels.ts", name: "publicOnFree" },
    },
  ],
};
