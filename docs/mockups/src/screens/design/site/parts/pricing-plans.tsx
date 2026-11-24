/**
 * The plans: two section boxes on the canvas, as the home page groups its
 * frames. Mokly CLI holds the open-source frame, and Mokly Cloud holds the
 * Free and Team frames. Each frame stacks the same four rows, the head, the
 * price, the action and the list, and the desktop composition lines the
 * rows up across the three frames. Team is the selected frame, with its
 * corner handles, its size tag and Maya's cursor.
 */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { classNames } from "./class-names.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import { SiteSectionBox } from "./labels.js";
import { SIGN_UP_SCREEN, SITE_SCREENS } from "./links.js";
import { SiteCursor } from "./people.js";
import { TEAM_SEATS } from "./pricing-data.js";
import { SiteSelection } from "./selection.js";

/** The size tag of the selected Team frame: its drawn size in each composition. */
const TEAM_SIZE = { desktop: "384 × 557", mobile: "350 × 537" } as const;

/** The arrow after a forward action's label. */
function Arrow() {
  return (
    <span aria-hidden="true" className="site-button-arrow">
      &#8594;
    </span>
  );
}

/**
 * One plan frame on the canvas: the frame label `plans/{id}`, then the head,
 * the price, the action and the list of what the plan holds. `children`
 * draws over the frame, as the selection does.
 */
function PlanFrame({
  action,
  children,
  features,
  id,
  name,
  price,
  selected = false,
  summary,
}: {
  action: ReactNode;
  children?: ReactNode;
  features: readonly string[];
  id: string;
  name: string;
  price: ReactNode;
  selected?: boolean;
  summary: string;
}) {
  return (
    <article
      aria-labelledby={`pricing-plan-${id}`}
      className={classNames(
        "site-pricing-plan",
        selected && "site-pricing-plan--selected",
      )}
    >
      <SiteFrameLabel name={`plans/${id}`} selected={selected} />
      <div className="site-pricing-plan-head">
        <h3 className="site-pricing-plan-name" id={`pricing-plan-${id}`}>
          {name}
        </h3>
        <p className="site-pricing-plan-for">{summary}</p>
      </div>
      <div className="site-pricing-plan-price">{price}</div>
      <div className="site-pricing-plan-action">{action}</div>
      <ul className="site-pricing-features">
        {features.map((feature) => (
          <li key={feature}>
            <SiteIcon name="check" />
            {feature}
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}

/** A plan's single price and the note under it. */
function PlanPrice({ amount, note }: { amount: string; note: string }) {
  return (
    <>
      <p className="site-pricing-amount">{amount}</p>
      <p className="site-pricing-price-note">{note}</p>
    </>
  );
}

/**
 * Team's two seat prices, one row each: the amount, its unit and, under
 * the unit, who holds that seat. The stop after the unit is read, not
 * shown, so a screen reader pauses before the seat holders.
 */
function TeamPrice() {
  return (
    <div className="site-pricing-seats">
      {TEAM_SEATS.map((seat) => (
        <p className="site-pricing-seat" key={seat.kind}>
          <span className="site-pricing-amount">{seat.amount}</span>{" "}
          <span className="site-pricing-seat-unit">
            per {seat.kind} a month
            <span className="site-visually-hidden">. </span>
            <small>{seat.holders}</small>
          </span>
        </p>
      ))}
    </div>
  );
}

/** The plans section: the Mokly CLI box and the Mokly Cloud box. */
export function PricingPlans({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <section
      aria-labelledby="pricing-plans-title"
      className="site-pricing-plans"
    >
      <h2 className="site-visually-hidden" id="pricing-plans-title">
        Plans
      </h2>
      <div className="site-pricing-plan-grid">
        <SiteSectionBox
          className="site-pricing-box site-pricing-box--cli"
          meta="@mokly/mokly"
          tag="Mokly CLI"
          tagId="pricing-box-cli"
        >
          <PlanFrame
            action={
              <MockLink
                className="site-button site-button--secondary"
                to={SITE_SCREENS.docs}
              >
                Docs <Arrow />
              </MockLink>
            }
            features={[
              "Author and build locally.",
              "Keep your screens in Git.",
              "Host the static catalogue anywhere.",
            ]}
            id="open-source"
            name="Open source"
            price={<PlanPrice amount="$0" note="MIT license" />}
            summary="For building catalogues locally."
          />
        </SiteSectionBox>
        <SiteSectionBox
          className="site-pricing-box site-pricing-box--cloud"
          meta="Every workspace is on a plan"
          tag="Mokly Cloud"
          tagId="pricing-box-cloud"
        >
          <PlanFrame
            action={
              <MockLink
                className="site-button site-button--secondary"
                to={SIGN_UP_SCREEN}
              >
                Create an account
              </MockLink>
            }
            features={[
              "Unlimited projects and seats.",
              "Publish and build public projects in the cloud.",
              "An owner can upgrade to Team in Settings.",
            ]}
            id="free"
            name="Free"
            price={<PlanPrice amount="$0" note="Every project is public." />}
            summary="For open-source catalogues."
          />
          <PlanFrame
            action={
              <>
                <MockLink
                  className="site-button site-button--primary"
                  to={SIGN_UP_SCREEN}
                >
                  Start a 7-day trial <Arrow />
                </MockLink>
                <p className="site-pricing-fine">In US dollars, before tax.</p>
              </>
            }
            features={[
              "Private projects in the same workspace.",
              "New projects start private.",
              "Publish and build private projects in the cloud.",
              "One trial per workspace.",
            ]}
            id="team"
            name="Team"
            price={<TeamPrice />}
            selected
            summary="For teams with private catalogues."
          >
            <SiteSelection handles="corners" size={TEAM_SIZE[viewport]} />
            <SiteCursor className="site-pricing-cursor" person="maya" />
          </PlanFrame>
        </SiteSectionBox>
      </div>
    </section>
  );
}
