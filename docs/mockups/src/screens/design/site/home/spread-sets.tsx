/**
 * The component sets in the spread's Components box: Button, PriceCard,
 * Badge, Avatar, Input and Toast, each a labelled box that draws the
 * component's variants at half size. One layer holds the sets, so a phone
 * can shrink them together. Codex has the Button set selected.
 */

import { SiteIcon } from "../parts/icons.js";
import { SiteSelection } from "../parts/selection.js";

import { AcmeSet, type AcmeSetName } from "./acme/acme-sets.js";
import { spotStyle, type CanvasSpot } from "./artboard.js";

const SETS: ReadonlyArray<{
  at: CanvasSpot;
  label: string;
  name: AcmeSetName;
}> = [
  { at: { x: 30, y: 78 }, label: "Button", name: "button" },
  { at: { x: 30, y: 172 }, label: "PriceCard", name: "priceCard" },
  { at: { x: 226, y: 78 }, label: "Badge", name: "badge" },
  { at: { x: 226, y: 172 }, label: "Avatar", name: "avatar" },
  { at: { x: 226, y: 270 }, label: "Input", name: "input" },
  { at: { x: 30, y: 404 }, label: "Toast", name: "toast" },
];

/** Every component set at its spot in the Components box. */
export function SpreadSets() {
  return (
    <div className="site-home-sets">
      {SETS.map((set) => (
        <div className="site-home-set" key={set.name} style={spotStyle(set.at)}>
          <span className="site-home-set-label">
            <SiteIcon name="component" size={12} />
            {set.label}
          </span>
          <div className="site-home-set-box">
            <div className="site-home-set-inner">
              <AcmeSet name={set.name} />
            </div>
          </div>
          {/* status: "ahead" (Codex) */}
          {set.name === "button" ? (
            <SiteSelection
              className="site-home-set-peer"
              handles="none"
              person="codex"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
