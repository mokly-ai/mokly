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
