/**
 * The product mockup inventory: every screen family, the states each screen
 * owns and the situations beyond them. `product-inventory.ts` derives the
 * catalogue structure these declarations require.
 */

/** The Milestone 11D contract, independent of entry discovery. */
export const productFamilies = {
  viewer: [
    "standalone",
    "pull-request",
    "projects",
    "switcher",
    "history",
    "share",
  ],
  account: [
    "sign-up",
    "sign-in",
    "magic-link",
    "create-workspace",
    "install-app",
    "choose-repository",
    "project-created",
    "invitation-accept",
  ],
  recovery: ["not-found"],
  settings: [
    "sections",
    "account",
    "workspace",
    "github",
    "members",
    "billing",
    "project",
    "tokens",
    "access",
    "danger",
  ],
} as const;

/** The canonical drawing and the three state variants every screen owns. */
export const productStates = ["default", "empty", "loading", "error"] as const;

/**
 * The shared sign-in landing has protocol-named outcomes rather than the
 * data-screen empty/loading/error taxonomy. Its canonical pending screen comes
 * first; each provider's first outcome is a screen whose other outcomes are its
 * variants, so no screen carries more than four. The desktop handoff is the
 * email landing outside the desktop app, a screen of its own after them. The
 * GitHub installation landings follow, each a screen of its own because each
 * says something the others do not; a reader starts that flow signed in, so
 * their header names the reader.
 */
export const callbackLandingPages = [
  { path: "product/account/callback", state: "pending" },
  { path: "product/account/callback/email-invalid", state: "invalid" },
  { path: "product/account/callback/email-invalid/expired", state: "expired" },
  { path: "product/account/callback/email-invalid/used", state: "used" },
  { path: "product/account/callback/email-invalid/failure", state: "failure" },
  { path: "product/account/callback/preview-invalid", state: "invalid" },
  {
    path: "product/account/callback/preview-invalid/failure",
    state: "failure",
  },
  { path: "product/account/callback/desktop", state: "handoff" },
  {
    path: "product/account/callback/install-requested",
    state: "requested",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-conflict",
    state: "conflict",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-denied",
    state: "denied",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-setup",
    state: "pending",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-authorize",
    state: "pending",
    signedIn: true,
  },
] as const;

/** The callback landing's screens and the exact order of their variants. */
export const callbackLandingScreens = [
  { path: "product/account/callback", variants: [] },
  {
    path: "product/account/callback/email-invalid",
    variants: [
      "product/account/callback/email-invalid/expired",
      "product/account/callback/email-invalid/used",
      "product/account/callback/email-invalid/failure",
    ],
  },
  {
    path: "product/account/callback/preview-invalid",
    variants: ["product/account/callback/preview-invalid/failure"],
  },
  { path: "product/account/callback/desktop", variants: [] },
  { path: "product/account/callback/install-requested", variants: [] },
  { path: "product/account/callback/install-conflict", variants: [] },
  { path: "product/account/callback/install-denied", variants: [] },
  { path: "product/account/callback/install-setup", variants: [] },
  { path: "product/account/callback/install-authorize", variants: [] },
] as const;

/**
 * Situations a screen owns beyond its four states: a drawing the running
 * product has that none of the four describes, with its own component, so no
 * state is asked to mean two things. A situation with one drawing is a variant
 * of the screen it belongs to while that screen stays within four variants;
 * otherwise, and whenever it has states of its own, it is a screen of its own
 * beside its owner, as `product-inventory.ts` derives.
 */
export const productSituations = [
  {
    path: "product/account/invitation-accept/expired",
    family: "account",
    screen: "invitation-accept",
    name: "expired",
    states: ["default"],
  },
  {
    path: "product/account/invitation-accept/open-error",
    family: "account",
    screen: "invitation-accept",
    name: "open-error",
    states: ["default"],
  },
  {
    path: "product/account/create-workspace/slug",
    family: "account",
    screen: "create-workspace",
    name: "slug",
    states: ["default", "empty", "error"],
  },
  {
    path: "product/account/create-workspace/suggestion-loading",
    family: "account",
    screen: "create-workspace",
    name: "suggestion-loading",
    states: ["default"],
  },
  // The step's loading drawing is its session read, and its page already
  // draws five, so Create workspace's write is a screen beside it.
  {
    path: "product/account/create-workspace/creating",
    family: "account",
    screen: "create-workspace",
    name: "creating",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/choose-repository/slug-taken",
    family: "account",
    screen: "choose-repository",
    name: "slug-taken",
    states: ["default", "empty"],
  },
  {
    path: "product/account/choose-repository/suggestion-loading",
    family: "account",
    screen: "choose-repository",
    name: "suggestion-loading",
    states: ["default"],
  },
  // The select open and the workspace with one account are screens beside the
  // step, so the pending address keeps its place among the step's variants.
  {
    path: "product/account/choose-repository/open",
    family: "account",
    screen: "choose-repository",
    name: "open",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/account/choose-repository/one-account",
    family: "account",
    screen: "choose-repository",
    name: "one-account",
    sibling: true,
    states: ["default"],
  },
  // Create project's write is a screen beside the step for the same reason.
  {
    path: "product/account/choose-repository/creating",
    family: "account",
    screen: "choose-repository",
    name: "creating",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/choose-repository/cli",
    family: "account",
    screen: "choose-repository",
    name: "cli",
    states: productStates,
  },
  // The CLI form's loading drawing is its write, so its workspace read is the
  // form's fifth drawing.
  {
    path: "product/account/choose-repository/cli/workspace-loading",
    family: "account",
    screen: "choose-repository",
    name: "workspace-loading",
    parent: "product/account/choose-repository/cli",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/install-app/member",
    family: "account",
    screen: "install-app",
    name: "member",
    states: ["default"],
  },
  {
    path: "product/account/install-app/reviewer",
    family: "account",
    screen: "install-app",
    name: "reviewer",
    states: ["default"],
  },
  {
    path: "product/account/install-app/suspended-unreadable",
    family: "account",
    screen: "install-app",
    name: "suspended-unreadable",
    states: ["default"],
  },
  {
    path: "product/account/install-app/suspended-loading",
    family: "account",
    screen: "install-app",
    name: "suspended-loading",
    states: ["default"],
  },
  {
    path: "product/account/install-app/installing",
    family: "account",
    screen: "install-app",
    name: "installing",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/install-app/connect",
    family: "account",
    screen: "install-app",
    name: "connect",
    states: productStates,
  },
  {
    path: "product/account/install-app/connect/one-workspace",
    family: "account",
    screen: "install-app",
    name: "one-workspace",
    parent: "product/account/install-app/connect",
    states: ["default"],
  },
  // Continue on GitHub's write: the connect situation already draws five, so
  // its write is a screen beside it, in its folder.
  {
    path: "product/account/install-app/connect/connecting",
    family: "account",
    screen: "install-app",
    name: "connecting",
    parent: "product/account/install-app/connect",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // Continue with GitHub's write on each entry screen, a screen beside it
  // like the other GitHub situations.
  {
    path: "product/account/sign-in/github-connecting",
    family: "account",
    screen: "sign-in",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-up/github-connecting",
    family: "account",
    screen: "sign-up",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-in/github-refused",
    family: "account",
    screen: "sign-in",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-refused",
    family: "account",
    screen: "sign-up",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/github-opens-soon",
    family: "account",
    screen: "sign-in",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-opens-soon",
    family: "account",
    screen: "sign-up",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/address-refused",
    family: "account",
    screen: "sign-in",
    name: "address-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/address-refused",
    family: "account",
    screen: "sign-up",
    name: "address-refused",
    states: ["default"],
  },
  // The Account pane asked for by its address while the settings scope
  // loads, and while the session loads before it, and Connect GitHub's write.
  // The pane's three states leave room for one more drawing only, so each is
  // a screen beside it.
  {
    path: "product/settings/account/scope-loading",
    family: "settings",
    screen: "account",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/account/session-loading",
    family: "settings",
    screen: "account",
    name: "session-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/account/github-connecting",
    family: "settings",
    screen: "account",
    name: "github-connecting",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/suspended",
    family: "settings",
    screen: "workspace",
    name: "suspended",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/absent",
    family: "settings",
    screen: "workspace",
    name: "absent",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/accounts-loading",
    family: "settings",
    screen: "workspace",
    name: "accounts-loading",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/accounts-unreadable",
    family: "settings",
    screen: "workspace",
    name: "accounts-unreadable",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/plan",
    family: "settings",
    screen: "workspace",
    name: "plan",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/plan-member",
    family: "settings",
    screen: "workspace",
    name: "plan-member",
    states: ["default"],
  },
  // The Workspace pane asked for by its address while the settings scope
  // loads, and Save's write.
  {
    path: "product/settings/workspace/scope-loading",
    family: "settings",
    screen: "workspace",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/saving",
    family: "settings",
    screen: "workspace",
    name: "saving",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/slug",
    family: "settings",
    screen: "workspace",
    name: "slug",
    states: productStates,
  },
  {
    path: "product/settings/github/suspended",
    family: "settings",
    screen: "github",
    name: "suspended",
    states: ["default"],
  },
  {
    path: "product/settings/github/member",
    family: "settings",
    screen: "github",
    name: "member",
    states: ["default"],
  },
  {
    path: "product/settings/github/menu",
    family: "settings",
    screen: "github",
    name: "menu",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/github/remove",
    family: "settings",
    screen: "github",
    name: "remove",
    states: ["default", "loading"],
    overlay: true,
  },
  // Add GitHub account's write, which leaves for GitHub.
  {
    path: "product/settings/github/adding",
    family: "settings",
    screen: "github",
    name: "adding",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/slug-recovery",
    family: "settings",
    screen: "workspace",
    name: "recovery",
    parent: "product/settings/workspace/slug",
    states: ["default", "error"],
  },
  {
    path: "product/settings/members/identity",
    family: "settings",
    screen: "members",
    name: "identity",
    states: ["default"],
  },
  // The pane asked for by its address while the settings scope loads. The
  // pane's page already draws four variants, so the wait is a screen beside
  // it, and its controls wait disabled.
  {
    path: "product/settings/members/scope-loading",
    family: "settings",
    screen: "members",
    name: "scope-loading",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // The pane's three writes on its own controls: Send invitation, Revoke
  // invitation and Save role. The pane's page already draws four variants,
  // so each write is a screen beside it.
  {
    path: "product/settings/members/invitation-sending",
    family: "settings",
    screen: "members",
    name: "invitation-sending",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/members/invitation-revoking",
    family: "settings",
    screen: "members",
    name: "invitation-revoking",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/members/role-saving",
    family: "settings",
    screen: "members",
    name: "role-saving",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/confirming",
    family: "settings",
    screen: "billing",
    name: "confirming",
    states: ["default"],
  },
  {
    path: "product/settings/billing/delayed",
    family: "settings",
    screen: "billing",
    name: "delayed",
    states: ["default"],
  },
  // Check again's write, a state of the delayed confirmation it belongs to.
  {
    path: "product/settings/billing/delayed/checking",
    family: "settings",
    screen: "billing",
    name: "checking",
    parent: "product/settings/billing/delayed",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/trial",
    family: "settings",
    screen: "billing",
    name: "trial",
    states: ["default"],
  },
  {
    path: "product/settings/billing/past-due",
    family: "settings",
    screen: "billing",
    name: "past-due",
    states: ["default"],
  },
  {
    path: "product/settings/billing/ending",
    family: "settings",
    screen: "billing",
    name: "ending",
    states: ["default"],
  },
  {
    path: "product/settings/billing/admin",
    family: "settings",
    screen: "billing",
    name: "admin",
    states: ["default"],
  },
  {
    path: "product/settings/billing/admin-free",
    family: "settings",
    screen: "billing",
    name: "admin-free",
    states: ["default"],
  },
  {
    path: "product/settings/billing/unavailable",
    family: "settings",
    screen: "billing",
    name: "unavailable",
    states: ["default"],
  },
  {
    path: "product/settings/billing/unpriced",
    family: "settings",
    screen: "billing",
    name: "unpriced",
    states: ["default"],
  },
  // The Billing pane asked for by its address while the session and the
  // settings scope load, as Stripe returns to it, and its durable route on a
  // wide surface until it hands over to the dialog: the same wait, with each
  // pane that the route has no address for disabled in the rail.
  {
    path: "product/settings/billing/scope-loading",
    family: "settings",
    screen: "billing",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/route-loading",
    family: "settings",
    screen: "billing",
    name: "route-loading",
    states: ["default"],
    pending: true,
  },
  // Upgrade to Team's and Manage billing's writes, which leave for Stripe.
  {
    path: "product/settings/billing/checkout-opening",
    family: "settings",
    screen: "billing",
    name: "checkout-opening",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/portal-opening",
    family: "settings",
    screen: "billing",
    name: "portal-opening",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/members/remove",
    family: "settings",
    screen: "members",
    name: "remove",
    states: ["default", "loading"],
    overlay: true,
  },
  {
    path: "product/settings/project/visibility",
    family: "settings",
    screen: "project",
    name: "visibility",
    states: ["default"],
    pending: true,
    overlay: true,
  },
  {
    path: "product/settings/tokens/create",
    family: "settings",
    screen: "tokens",
    name: "create",
    states: ["default", "loading", "error"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/create/reveal",
    family: "settings",
    screen: "tokens",
    name: "reveal",
    parent: "product/settings/tokens/create",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/project/visibility/plan",
    family: "settings",
    screen: "project",
    name: "plan",
    parent: "product/settings/project/visibility",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/project/visibility/plan-admin",
    family: "settings",
    screen: "project",
    name: "plan-admin",
    parent: "product/settings/project/visibility",
    states: ["default"],
    overlay: true,
  },
  // The visibility write in flight for a public project made private.
  {
    path: "product/settings/project/visibility/private",
    family: "settings",
    screen: "project",
    name: "private",
    parent: "product/settings/project/visibility",
    states: ["default"],
    pending: true,
    overlay: true,
  },
  {
    path: "product/settings/project/slug",
    family: "settings",
    screen: "project",
    name: "slug",
    states: productStates,
  },
  {
    path: "product/settings/project/slug/conflict",
    family: "settings",
    screen: "project",
    name: "conflict",
    parent: "product/settings/project/slug",
    states: ["default"],
  },
  {
    path: "product/settings/project/no-builds",
    family: "settings",
    screen: "project",
    name: "no-builds",
    states: ["default"],
  },
  // The Automatic builds switch's own write. The pane's page already draws
  // its four variants, so the write is a screen beside it.
  {
    path: "product/settings/project/builds-saving",
    family: "settings",
    screen: "project",
    name: "builds-saving",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // The pane asked for by its address while the settings scope loads. The
  // pane's page already draws its four variants, so the wait is a screen
  // beside it, and its controls wait as placeholders.
  {
    path: "product/settings/project/scope-loading",
    family: "settings",
    screen: "project",
    name: "scope-loading",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/tokens/create/copy",
    family: "settings",
    screen: "tokens",
    name: "copy",
    parent: "product/settings/tokens/create",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/revoke",
    family: "settings",
    screen: "tokens",
    name: "revoke",
    states: ["default", "loading"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/revoke/menu",
    family: "settings",
    screen: "tokens",
    name: "menu",
    parent: "product/settings/tokens/revoke",
    states: ["default"],
    overlay: true,
  },
  // The Delete project pane asked for by its address while the settings
  // scope loads: the pane's fifth drawing, beside its four states.
  {
    path: "product/settings/danger/scope-loading",
    family: "settings",
    screen: "danger",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/reader",
    family: "viewer",
    screen: "standalone",
    name: "reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/version",
    family: "viewer",
    screen: "standalone",
    name: "version",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/unreadable",
    family: "viewer",
    screen: "standalone",
    name: "unreadable",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/account",
    family: "viewer",
    screen: "standalone",
    name: "account",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/failed",
    family: "viewer",
    screen: "standalone",
    name: "failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/latest",
    family: "viewer",
    screen: "standalone",
    name: "latest",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan",
    family: "viewer",
    screen: "standalone",
    name: "plan",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan-reader",
    family: "viewer",
    screen: "standalone",
    name: "plan-reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/workspace-unreadable",
    family: "viewer",
    screen: "standalone",
    name: "workspace-unreadable",
    states: ["default"],
  },
  // The viewer's waits that are situations of their own: the route's project
  // read, whose bar's controls wait disabled, the read of a publication's
  // address, whose reference trigger waits as a placeholder, the workspace
  // read that decides the Team card, and a publication that CI still uploads.
  {
    path: "product/viewer/standalone/project-loading",
    family: "viewer",
    screen: "standalone",
    name: "project-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/publication-loading",
    family: "viewer",
    screen: "standalone",
    name: "publication-loading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan-loading",
    family: "viewer",
    screen: "standalone",
    name: "plan-loading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/uploading",
    family: "viewer",
    screen: "standalone",
    name: "uploading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/catalogue",
    family: "viewer",
    screen: "standalone",
    name: "catalogue",
    states: ["default", "loading", "error"],
  },
  {
    path: "product/viewer/standalone/catalogue/comparison",
    family: "viewer",
    screen: "standalone",
    name: "comparison",
    parent: "product/viewer/standalone/catalogue",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build",
    family: "viewer",
    screen: "standalone",
    name: "build",
    states: productStates,
  },
  {
    path: "product/viewer/standalone/build/published",
    family: "viewer",
    screen: "standalone",
    name: "published",
    parent: "product/viewer/standalone/build",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/failed",
    family: "viewer",
    screen: "standalone",
    name: "failed",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/failed/timed-out",
    family: "viewer",
    screen: "standalone",
    name: "timed-out",
    parent: "product/viewer/standalone/build/failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/failed/infrastructure",
    family: "viewer",
    screen: "standalone",
    name: "infrastructure",
    parent: "product/viewer/standalone/build/failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/failed/plan",
    family: "viewer",
    screen: "standalone",
    name: "plan",
    parent: "product/viewer/standalone/build/failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/failed/version",
    family: "viewer",
    screen: "standalone",
    name: "version",
    parent: "product/viewer/standalone/build/failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/superseded",
    family: "viewer",
    screen: "standalone",
    name: "superseded",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/superseded/cancelled",
    family: "viewer",
    screen: "standalone",
    name: "cancelled",
    parent: "product/viewer/standalone/build/superseded",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/unreadable",
    family: "viewer",
    screen: "standalone",
    name: "unreadable",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/lockfile",
    family: "viewer",
    screen: "standalone",
    name: "lockfile",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/refused",
    family: "viewer",
    screen: "standalone",
    name: "refused",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/refused/cancel",
    family: "viewer",
    screen: "standalone",
    name: "cancel",
    parent: "product/viewer/standalone/build/refused",
    states: ["default"],
  },
  // Cancel and Try again while their requests run. The running and the
  // failed build already draw four variants each, so each write is a screen
  // beside them.
  {
    path: "product/viewer/standalone/build/cancel-busy",
    family: "viewer",
    screen: "standalone",
    name: "cancel-busy",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/build/try-again-busy",
    family: "viewer",
    screen: "standalone",
    name: "try-again-busy",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/build/reader",
    family: "viewer",
    screen: "standalone",
    name: "reader",
    parent: "product/viewer/standalone/build",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/reader/plan",
    family: "viewer",
    screen: "standalone",
    name: "plan",
    parent: "product/viewer/standalone/build/reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/reader/plan-loading",
    family: "viewer",
    screen: "standalone",
    name: "plan-loading",
    parent: "product/viewer/standalone/build/reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/reader/queued",
    family: "viewer",
    screen: "standalone",
    name: "queued",
    parent: "product/viewer/standalone/build/reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/build/reader/running",
    family: "viewer",
    screen: "standalone",
    name: "running",
    parent: "product/viewer/standalone/build/reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish",
    family: "viewer",
    screen: "standalone",
    name: "publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/pull-request",
    family: "viewer",
    screen: "standalone",
    name: "pull-request",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/reader",
    family: "viewer",
    screen: "standalone",
    name: "reader",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/publishing",
    family: "viewer",
    screen: "standalone",
    name: "publishing",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/reader-pull-request",
    family: "viewer",
    screen: "standalone",
    name: "reader-pull-request",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish-refused",
    family: "viewer",
    screen: "standalone",
    name: "publish-refused",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish-refused/pull-request",
    family: "viewer",
    screen: "standalone",
    name: "pull-request",
    parent: "product/viewer/standalone/publish-refused",
    states: ["default"],
  },
  // Publish this branch while its build request runs, a screen beside the
  // publishing card, which already draws four variants.
  {
    path: "product/viewer/standalone/publish-busy",
    family: "viewer",
    screen: "standalone",
    name: "publish-busy",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/pull-request/publishing",
    family: "viewer",
    screen: "pull-request",
    name: "publishing",
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/closed",
    family: "viewer",
    screen: "pull-request",
    name: "closed",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/closed/merged",
    family: "viewer",
    screen: "pull-request",
    name: "merged",
    parent: "product/viewer/pull-request/closed",
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/fork",
    family: "viewer",
    screen: "pull-request",
    name: "fork",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/plan",
    family: "viewer",
    screen: "pull-request",
    name: "plan",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/plan/reader",
    family: "viewer",
    screen: "pull-request",
    name: "reader",
    parent: "product/viewer/pull-request/plan",
    states: ["default"],
  },
  {
    path: "product/viewer/switcher/no-branches",
    family: "viewer",
    screen: "switcher",
    name: "no-branches",
    states: ["default"],
  },
  {
    path: "product/viewer/share/catalogue",
    family: "viewer",
    screen: "share",
    name: "catalogue",
    states: ["default"],
  },
] as const satisfies readonly {
  path: string;
  family: keyof typeof productFamilies;
  screen: string;
  name: string;
  states: readonly (typeof productStates)[number][];
  /** The path of the situation this one belongs to, rather than the screen. */
  parent?: string;
  /**
   * The situation is a screen beside its parent, in the folder the parent's
   * path owns, and never one of the parent's variants: the build details
   * beside the running build are screens of their own.
   */
  sibling?: boolean;
  /**
   * The drawing holds a write or a read in flight, so a refused press or a
   * control that waits disabled is the point.
   */
  pending?: boolean;
  /**
   * The pane opened an overlay over itself — a confirmation, a reveal or its
   * row menu — so the document carries the overlay's dialog beside the
   * frame's, and the mobile layer carries the overlay's where a pane alone
   * carries none.
   */
  overlay?: boolean;
}[];

/**
 * State variants that repeat their screen's canonical drawing, and why. Every
 * screen owns its Empty, Loading and Error variants, but a product screen does
 * not always have four situations: where it has fewer, the spare variant
 * repeats the canonical content rather than inventing a situation the route
 * cannot reach. The reason is recorded here so the next author neither invents
 * one nor deletes the variant.
 */
export const repeatedStates = [
  {
    screen: "product/account/install-app",
    state: "empty",
    reason:
      "the step is drawn only while the workspace has nothing bound, which is the canonical drawing, so there is no emptier one for it to show",
  },
  {
    screen: "product/recovery/not-found",
    state: "empty",
    reason:
      "the unmatched route reads no product data, so it has no missing-data situation distinct from its canonical recovery",
  },
  {
    screen: "product/recovery/not-found",
    state: "loading",
    reason:
      "the unmatched route reads no product data, so it has no pending situation distinct from its canonical recovery",
  },
  {
    screen: "product/recovery/not-found",
    state: "error",
    reason:
      "the unmatched route reads no product data, so it has no failed-read situation distinct from its canonical recovery",
  },
] as const satisfies readonly {
  screen: string;
  state: (typeof productStates)[number];
  reason: string;
}[];

/** Every state entry path of one situation, in the order its screen lists them. */
export function situationStatePaths(
  situation: (typeof productSituations)[number],
): string[] {
  return situation.states.map((state) =>
    state === "default" ? situation.path : situation.path + "/" + state,
  );
}

/**
 * Situation screens that draw a write in flight or a read's wait. A control
 * drawn disabled is the subject of these screens, exactly as it is in an
 * empty or loading state.
 */
export const pendingSituationPaths = productSituations
  .filter((situation) => "pending" in situation && situation.pending)
  .flatMap((situation) => situationStatePaths(situation));
