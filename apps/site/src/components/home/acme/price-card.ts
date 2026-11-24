/**
 * The plans of the depicted acme/storefront app, which `PriceCard.astro`
 * draws, and the two values of the card that the team changes in the
 * home's Review and Edit frames: its padding, from 16 to 24, and its button
 * tone, from Secondary to Primary. These prices are acme's, not Mokly's.
 */
import type { AcmeRoast } from "./acme-bag.js";

/** One subscription plan of the coffee shop. */
export interface AcmePlan {
  /** The bags that the desktop card draws above the name; the first tints. */
  readonly art: readonly AcmeRoast[];
  readonly badge?: string;
  readonly featured?: boolean;
  readonly items: readonly string[];
  readonly line: string;
  readonly name: string;
  readonly price: number;
}

/** The shop's three plans. */
export const ACME_PLANS = {
  cafe: {
    art: ["decaf", "guji", "huila"],
    items: ["Free shipping", "Grinder on loan"],
    line: "Five bags for a busy kitchen.",
    name: "Café",
    price: 70,
  },
  regular: {
    art: ["huila", "nyeri"],
    badge: "Most popular",
    featured: true,
    items: ["Free shipping", "Choose your roast", "Skip any month"],
    line: "Two 250 g bags, roasted to order.",
    name: "Regular",
    price: 32,
  },
  taster: {
    art: ["guji"],
    items: ["Choose your roast", "Skip any month"],
    line: "One 250 g bag a month.",
    name: "Taster",
    price: 18,
  },
} as const satisfies Record<string, AcmePlan>;

/** The key of one plan. */
export type AcmePlanKey = keyof typeof ACME_PLANS;

/** The card's padding: the value before the change and after it. */
export type PriceCardPadding = 16 | 24;

/** The tone of the card's button: Secondary before the change. */
export type PriceCardTone = "primary" | "secondary";
