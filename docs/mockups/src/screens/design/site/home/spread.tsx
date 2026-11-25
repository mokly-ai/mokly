/**
 * The spread under the hero: the whole acme/storefront app on the canvas,
 * zoomed out. On the desktop composition a Specs box holds eight artboards
 * of phones and desktops in both schemes, and a Components box beside it
 * holds the component sets. Claude edits the pricing page, Codex has the
 * Button set selected and Sam is on checkout. Where the window cannot hold
 * all of it, the Specs box first drops its right column, the roomy parts,
 * and then the Components box folds under it; the 1280px desktop frame
 * draws the first step. On the mobile composition the spread is three
 * phones with the middle one centred, and the Components box under them
 * with its sets at 70 percent. The whole spread is a depiction.
 */

import type { ReactNode } from "react";

import { SiteSectionBox } from "../parts/labels.js";
import { SiteCursor } from "../parts/people.js";
import { SiteSelection } from "../parts/selection.js";

import { AcmePaymentPhone, AcmeReviewOrder } from "./acme/acme-checkout.js";
import { AcmePricingDesktop, AcmePricingPhone } from "./acme/acme-pricing.js";
import { AcmeSettings } from "./acme/acme-settings.js";
import { AcmeWelcome } from "./acme/acme-welcome.js";
import { Artboard, type CanvasSpot } from "./artboard.js";
import { SpreadSets } from "./spread-sets.js";
import { StorybookMark } from "./storybook-mark.js";

/** One artboard of the spread and where it sits on each composition. */
interface SpreadBoard {
  dark?: boolean;
  device: "desktop" | "phone";
  /** The spot on the mobile composition, in the Specs box. */
  mobile?: CanvasSpot;
  name: string;
  overlay?: ReactNode;
  /** Drawn only where the window holds the whole spread. */
  roomy?: boolean;
  screen: ReactNode;
  /** The spot on the desktop composition, in the Specs box. */
  wide: CanvasSpot;
}

const BOARDS: readonly SpreadBoard[] = [
  {
    device: "phone",
    mobile: { x: -87, y: 52 },
    name: "onboarding/welcome",
    screen: <AcmeWelcome />,
    wide: { x: 30, y: 78 },
  },
  {
    device: "phone",
    mobile: { x: 93, y: 52 },
    name: "checkout/payment",
    screen: <AcmePaymentPhone />,
    wide: { x: 198, y: 78 },
  },
  {
    dark: true,
    device: "phone",
    mobile: { x: 273, y: 52 },
    name: "checkout/review-order",
    screen: <AcmeReviewOrder />,
    wide: { x: 366, y: 78 },
  },
  {
    device: "desktop",
    name: "pricing",
    // status: "ahead" (agent sessions, Claude)
    overlay: (
      <SiteSelection
        className="site-home-spread-peer"
        handles="none"
        person="claude"
        tag="Claude is editing"
      />
    ),
    roomy: true,
    screen: <AcmePricingDesktop />,
    wide: { x: 534, y: 78 },
  },
  {
    dark: true,
    device: "desktop",
    name: "account/settings",
    screen: <AcmeSettings />,
    wide: { x: 30, y: 462 },
  },
  {
    device: "phone",
    name: "pricing",
    roomy: true,
    screen: <AcmePricingPhone />,
    wide: { x: 519, y: 462 },
  },
  {
    dark: true,
    device: "phone",
    name: "pricing",
    roomy: true,
    screen: <AcmePricingPhone dark />,
    wide: { x: 687, y: 462 },
  },
  {
    dark: true,
    device: "phone",
    name: "checkout/payment",
    roomy: true,
    screen: <AcmePaymentPhone dark />,
    wide: { x: 855, y: 462 },
  },
];

/** The spread of the rendered composition. */
export function Spread({ viewport }: { viewport: "mobile" | "desktop" }) {
  const wide = viewport === "desktop";
  const boards = wide
    ? BOARDS
    : BOARDS.filter((board) => board.mobile !== undefined);
  return (
    <div aria-hidden="true" className="site-home-spread">
      <div className="site-home-spread-canvas">
        <SiteSectionBox
          className="site-home-spread-specs"
          meta="acme/storefront · main · 24 screens"
          tag="Specs"
        >
          {boards.map((board, index) => (
            <Artboard
              at={wide ? board.wide : board.mobile}
              className={board.roomy ? "site-home-spread-roomy" : undefined}
              dark={board.dark}
              device={board.device}
              key={index}
              name={board.name}
              overlay={board.overlay}
            >
              {board.screen}
            </Artboard>
          ))}
        </SiteSectionBox>
        <SiteSectionBox
          className="site-home-spread-components"
          meta={
            <span className="site-home-works">
              works with
              <StorybookMark />
              <b>Storybook</b>
            </span>
          }
          tag="Components"
        >
          <SpreadSets />
        </SiteSectionBox>
        {/* status: "ahead" (Claude) */}
        <SiteCursor
          className="site-home-spread-claude site-home-spread-roomy"
          person="claude"
        />
        {/* status: "ahead" (Codex) */}
        <SiteCursor className="site-home-spread-codex" person="codex" />
        {wide ? (
          <SiteCursor className="site-home-spread-sam" person="sam" />
        ) : null}
      </div>
    </div>
  );
}
