/**
 * The lists that the depicted acme screens draw: the account menu of the
 * settings screen and the brew choices of the welcome screen.
 * `AcmeSettings.astro` and `AcmeWelcome.astro` read them.
 */
import type { AcmeIconName } from "./acme-icons.js";

/** The account menu, in order, each an icon and a label. */
export const ACME_ACCOUNT_MENU: ReadonlyArray<
  readonly [icon: AcmeIconName, label: string]
> = [
  ["box", "Orders"],
  ["repeat", "Subscription"],
  ["card", "Payment"],
  ["pin", "Addresses"],
  ["gear", "Settings"],
];

/** The account menu row of the settings screen, which is current. */
export const ACME_ACCOUNT_CURRENT = "Settings";

/** The brew choices of the welcome screen; the first is chosen. */
export const ACME_BREWS = [
  "Filter",
  "Espresso",
  "Cold brew",
  "French press",
] as const;
