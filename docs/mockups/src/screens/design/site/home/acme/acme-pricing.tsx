/**
 * The depicted acme `pricing` screen on a phone and on a desktop, in either
 * scheme, with the PriceCard's padding and button tone as they stand before
 * or after the team's change. The desktop navigation is shared with the
 * other desktop screens.
 */

import { classNames } from "../../parts/class-names.js";

import { AcmeIcon } from "./acme-icons.js";
import {
  AcmeAvatar,
  AcmeCart,
  AcmeLogo,
  AcmeSegmented,
  AcmeStatus,
} from "./acme-parts.js";
import {
  PriceCard,
  type PriceCardPadding,
  type PriceCardTone,
} from "./price-card.js";

/** The PriceCard values that a pricing screen draws. */
interface AcmePricingProps {
  dark?: boolean | undefined;
  padding?: PriceCardPadding | undefined;
  tone?: PriceCardTone | undefined;
}

const LINKS = ["Shop", "Subscriptions", "Brew guides", "Journal"] as const;

/** The shop's desktop navigation, with Subscriptions current. */
function AcmeDesktopNav() {
  return (
    <div className="site-acme-desktop-nav">
      <AcmeLogo />
      <span className="site-acme-desktop-links">
        {LINKS.map((link) => (
          <span
            className={
              link === "Subscriptions" ? "site-acme-desktop-on" : undefined
            }
            key={link}
          >
            {link}
          </span>
        ))}
      </span>
      <span className="site-acme-desktop-end">
        <AcmeIcon name="search" />
        <AcmeCart />
        <AcmeAvatar initials="JE" size="small" />
      </span>
    </div>
  );
}

/** The heading block above the plans. */
function PricingHead({ large = false }: { large?: boolean }) {
  return (
    <>
      <div className="site-acme-eyebrow">Subscriptions</div>
      <div
        className={classNames(
          "site-acme-title",
          large && "site-acme-title--display",
        )}
      >
        Pick your plan
      </div>
      <div className="site-acme-sub">
        Fresh roasts at your door. Pause or skip any month.
      </div>
      <AcmeSegmented />
    </>
  );
}

/** `pricing` on a phone: the featured Regular plan, then Taster. */
export function AcmePricingPhone({
  dark = false,
  padding = 24,
  tone = "primary",
}: AcmePricingProps) {
  return (
    <div
      className={classNames(
        "site-acme site-acme--phone",
        dark && "site-acme--dark",
      )}
    >
      <AcmeStatus />
      <div className="site-acme-phone-nav">
        <AcmeLogo />
        <span className="site-acme-phone-nav-end">
          <AcmeCart />
          <AcmeAvatar initials="JE" size="small" />
        </span>
      </div>
      <div className="site-acme-pricing">
        <PricingHead />
        <PriceCard padding={padding} plan="regular" target tone={tone} />
        <PriceCard padding={padding} plan="taster" />
      </div>
    </div>
  );
}

/** `pricing` on a desktop: three plans side by side, with their bags. */
export function AcmePricingDesktop({
  dark = false,
  padding = 24,
  tone = "primary",
}: AcmePricingProps) {
  return (
    <div
      className={classNames(
        "site-acme site-acme--desktop",
        dark && "site-acme--dark",
      )}
    >
      <AcmeDesktopNav />
      <div className="site-acme-pricing-desktop">
        <div className="site-acme-pricing-head">
          <PricingHead large />
        </div>
        <div className="site-acme-pricing-grid">
          <PriceCard art padding={padding} plan="taster" />
          <PriceCard art padding={padding} plan="regular" tone={tone} />
          <PriceCard art padding={padding} plan="cafe" />
        </div>
      </div>
    </div>
  );
}
