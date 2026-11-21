/**
 * The depicted acme `pricing` screens: the values of the PriceCard that a
 * pricing screen draws, and the links of the shop's desktop navigation.
 * `AcmePricingPhone.astro` and `AcmePricingDesktop.astro` read them.
 */
import type { PriceCardPadding, PriceCardTone } from "./price-card.js";

/** The PriceCard values that a pricing screen draws, and its scheme. */
export interface AcmePricingProps {
  /** The app's dark screen. */
  readonly dark?: boolean;
  /** The PriceCard's padding: 24, after the change, by default. */
  readonly padding?: PriceCardPadding;
  /** The featured card's button tone: Primary, after the change, by default. */
  readonly tone?: PriceCardTone;
}

/** The shop's desktop navigation, in order; Subscriptions is current. */
export const ACME_LINKS = [
  "Shop",
  "Subscriptions",
  "Brew guides",
  "Journal",
] as const;

/** The link of the screen that the desktop navigation marks current. */
export const ACME_CURRENT_LINK: (typeof ACME_LINKS)[number] = "Subscriptions";
