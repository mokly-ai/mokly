/**
 * The PriceCard of the depicted acme/storefront app, the component that the
 * home's Review and Edit frames discuss: a plan's name, price, line, list
 * and button. Its padding and its button tone are the two values that the
 * team changes, from 16 and Secondary to 24 and Primary.
 */

import { classNames } from "../../parts/class-names.js";

import { AcmeBag, roastTone, type AcmeRoast } from "./acme-bag.js";
import { AcmeIcon } from "./acme-icons.js";
import { AcmeBadge, AcmeButton } from "./acme-parts.js";

/** One subscription plan of the coffee shop. These prices are acme's. */
interface AcmePlan {
  art: readonly AcmeRoast[];
  badge?: string;
  featured?: boolean;
  items: readonly string[];
  line: string;
  name: string;
  price: number;
}

/** The shop's three plans. */
const ACME_PLANS = {
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

/** The card's padding: the value before the change and after it. */
export type PriceCardPadding = 16 | 24;

/** The tone of the card's button: Secondary before the change. */
export type PriceCardTone = "primary" | "secondary";

/**
 * One plan's card. `art` draws the plan's bags above the name, as the
 * desktop page does; `target` marks the card that a selection depicts.
 */
export function PriceCard({
  art = false,
  padding = 24,
  plan,
  target = false,
  tone,
}: {
  art?: boolean | undefined;
  padding?: PriceCardPadding | undefined;
  plan: keyof typeof ACME_PLANS;
  target?: boolean | undefined;
  tone?: PriceCardTone | undefined;
}) {
  const data: AcmePlan = ACME_PLANS[plan];
  const [lead] = data.art;
  return (
    <div
      className={classNames(
        "site-acme-price-card",
        `site-acme-price-card--pad-${padding}`,
        data.featured && "site-acme-price-card--featured",
        target && "site-acme-price-card--target",
      )}
    >
      {art && lead !== undefined ? (
        <div
          className={classNames("site-acme-price-card-art", roastTone(lead))}
        >
          {data.art.map((roast) => (
            <AcmeBag key={roast} roast={roast} />
          ))}
        </div>
      ) : null}
      <div className="site-acme-price-card-top">
        <span className="site-acme-price-card-name">{data.name}</span>
        {data.badge === undefined ? null : <AcmeBadge>{data.badge}</AcmeBadge>}
      </div>
      <div className="site-acme-price-card-price">
        <b>${data.price}</b>
        <span>/ month</span>
      </div>
      <div className="site-acme-price-card-line">{data.line}</div>
      <div className="site-acme-price-card-list">
        {data.items.map((item) => (
          <span key={item}>
            <AcmeIcon name="check" />
            {item}
          </span>
        ))}
      </div>
      <AcmeButton
        block
        className="site-acme-price-card-button"
        tone={tone ?? "secondary"}
      >
        Choose {data.name}
      </AcmeButton>
    </div>
  );
}
