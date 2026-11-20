/**
 * The component sets of the depicted acme/storefront app, as the spread's
 * Components box shows them: each set draws the variants of one component
 * on a light backing.
 */

import type { ReactNode } from "react";

import { AcmeTile } from "./acme-bag.js";
import { AcmeAvatar, AcmeBadge, AcmeButton, AcmeField } from "./acme-parts.js";
import { PriceCard } from "./price-card.js";

/** The name of one component set. */
export type AcmeSetName =
  "avatar" | "badge" | "button" | "input" | "priceCard" | "toast";

const SETS: Record<AcmeSetName, () => ReactNode> = {
  avatar: () => (
    <div className="site-acme-set-row">
      <AcmeAvatar initials="JE" size="large" />
      <AcmeAvatar initials="RK" size="large" tone="sage" />
      <AcmeAvatar initials="AM" size="large" tone="plum" />
      <AcmeAvatar initials="+4" size="large" tone="cream" />
    </div>
  ),
  badge: () => (
    <div className="site-acme-set-row">
      <AcmeBadge>Most popular</AcmeBadge>
      <AcmeBadge tone="sage">New roast</AcmeBadge>
      <AcmeBadge tone="plum">Decaf</AcmeBadge>
      <AcmeBadge tone="muted">Sold out</AcmeBadge>
    </div>
  ),
  button: () => (
    <div className="site-acme-set-row">
      <AcmeButton>Continue</AcmeButton>
      <AcmeButton tone="secondary">Back</AcmeButton>
      <AcmeButton tone="danger">Delete</AcmeButton>
    </div>
  ),
  input: () => (
    <div className="site-acme-set-column">
      <AcmeField label="Email" value="jordan@example.com" />
      <AcmeField label="Email" state="focus" value="jordan@exam" />
      <AcmeField
        label="Email"
        note="Enter a full email address."
        state="error"
        value="jordan@"
      />
    </div>
  ),
  priceCard: () => <PriceCard plan="regular" tone="primary" />,
  toast: () => (
    <div className="site-acme-toast">
      <AcmeTile roast="guji" size="small" />
      <span className="site-acme-lines">
        <b>Added to bag</b>
        <i>Guji, Ethiopia · 250 g</i>
      </span>
      <span className="site-acme-toast-undo">Undo</span>
    </div>
  ),
};

/** One component set, drawn bare on the set's backing. */
export function AcmeSet({ name }: { name: AcmeSetName }) {
  return <div className="site-acme site-acme--bare">{SETS[name]()}</div>;
}
