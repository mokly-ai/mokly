/**
 * The open foundation: the closing copy with Get started and View on
 * GitHub, then the frame where `pricing.mockup.tsx` in the dark code panel
 * is wired to the rendered `pricing` artboard, the build in the terminal,
 * the four facts of the open-source CLI and the three steps as a flow of
 * frames. Cal asked for no outer selection on this frame, so it carries
 * only its label; on a phone the artboard follows the code and the wire
 * leaves.
 */

import { SiteActions } from "../parts/actions.js";
import { CodePanel } from "../parts/code_panel.js";
import { SiteIcon, type SiteIconName } from "../parts/icons.js";
import { SiteKicker } from "../parts/labels.js";
import { SiteCursor } from "../parts/people.js";

import { AcmePricingPhone } from "./acme/acme-pricing.js";
import { Artboard } from "./artboard.js";
import { CardSelection } from "./card-selection.js";
import { FitWire } from "./fit-lines.js";
import { PRICING_SOURCE, WIRED_LINES } from "./foundation-source.js";
import { ModuleFrame } from "./module.js";
import { Steps } from "./steps.js";

/** The build in the terminal under the source. */
function Terminal() {
  return (
    <div className="site-home-terminal">
      <p>
        <span aria-hidden="true" className="site-home-terminal-prompt">
          $
        </span>
        npx mokly build
      </p>
      <p className="site-home-terminal-out">
        <SiteIcon name="check" size={14} />
        24 screens · mobile and desktop · light and dark
      </p>
      <p className="site-home-terminal-out">
        <SiteIcon name="check" size={14} />
        Wrote mokly-static/
      </p>
    </div>
  );
}

/** The wire from the PriceCard's source lines to the rendered card. */
function Wire() {
  const from = { x: 698, y: 311 };
  const to = { x: 806, y: 294 };
  const reach = (to.x - from.x) / 2;
  return (
    <svg aria-hidden="true" className="site-home-wire" focusable="false">
      <path
        className="site-home-wire-path"
        d={`M${from.x} ${from.y} C ${from.x + reach} ${from.y}, ${to.x - reach} ${to.y}, ${to.x} ${to.y}`}
      />
      <circle className="site-home-wire-end" cx={from.x} cy={from.y} r="3.5" />
      <circle className="site-home-wire-end" cx={to.x} cy={to.y} r="3.5" />
    </svg>
  );
}

const FACTS: ReadonlyArray<readonly [SiteIconName, string]> = [
  ["cube", "@mokly/mokly"],
  ["checkCircle", "MIT license"],
  ["terminal", "The CLI runs locally"],
  ["globe", "Host the catalogue anywhere"],
];

/** The open-foundation section. */
export function Foundation({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <section
      aria-labelledby="foundation-title"
      className="site-closing"
      id="foundation"
    >
      <div className="site-closing-copy">
        <SiteKicker>An open foundation</SiteKicker>
        <h2 id="foundation-title">
          Your screens.
          <br />
          <span>Your building blocks.</span>
        </h2>
        <div className="site-closing-panel">
          <p>
            Author locally with the open-source Mokly CLI. Keep your screens in
            Git and host the catalogue anywhere. The cloud adds hosting, review
            and the agent; it never owns the source.
          </p>
          <SiteActions secondary="github" />
        </div>
      </div>
      <ModuleFrame className="site-home-source" name="Open foundation">
        <CodePanel
          copy={false}
          files={["pricing.mockup.tsx", "price-card.tsx"]}
          foot={<Terminal />}
          language="tsx"
          lines={PRICING_SOURCE}
          lit={WIRED_LINES}
          meta="src/mockups"
          numbered
        />
        <div aria-hidden="true" className="site-home-source-board">
          <Artboard
            device="phone"
            name="pricing"
            overlay={<CardSelection tall />}
          >
            <AcmePricingPhone />
          </Artboard>
          {/* status: "ahead" (Codex) */}
          <SiteCursor className="site-home-source-codex" person="codex" />
        </div>
        {viewport === "desktop" ? (
          <>
            <Wire />
            <FitWire size="large" />
            <FitWire size="small" />
          </>
        ) : null}
      </ModuleFrame>
      <ul className="site-home-facts">
        {FACTS.map(([icon, fact]) => (
          <li key={fact}>
            <SiteIcon name={icon} />
            {fact}
          </li>
        ))}
      </ul>
      <Steps />
    </section>
  );
}
