import { DESTINATIONS } from "./destinations.js";
import type { Crumb } from "./shell.js";

/**
 * Paths of the depicted catalogue's current entries: the identity the path
 * chip and Details show. The depicted spec root has no prefix, so each path is
 * the entry's folders followed by its slug, and a README is its folder's page.
 */
export const ENTRY_PATHS = {
  exampleOverview: "example",
  welcome: "example/screens/welcome",
  welcomeEmpty: "example/screens/welcome/empty",
  welcomeError: "example/screens/welcome/error",
  details: "example/screens/details",
  tour: "example/tour",
  gettingStarted: "example/getting-started",
  invoice: "account/billing/invoice",
  invoiceOverdue: "account/billing/invoice/overdue",
  paymentTerms: "account/billing/payment-terms",
  profile: "account/profile",
  profileSecurity: "account/profile/security",
} as const;

/** The paths the moved billing entries had at the branch point. */
export const PREVIOUS_PATHS = {
  invoice: "billing/invoice",
  invoiceOverdue: "billing/invoice/overdue",
  paymentTerms: "billing/payment-terms",
} as const;

/**
 * The Example folder's README is the folder's own page, so its crumb opens
 * that page from All. Changes states and removed entries keep folder crumbs as
 * text, as they keep a parent entry's crumb.
 */
export const EXAMPLE_CRUMB = {
  label: "Example",
  to: DESTINATIONS.exampleOverview,
} as const satisfies Crumb;

/** Crumbs of a current screen in Example › Screens, viewed from All. */
export const SCREEN_CRUMBS: readonly Crumb[] = [EXAMPLE_CRUMB, "Screens"];
