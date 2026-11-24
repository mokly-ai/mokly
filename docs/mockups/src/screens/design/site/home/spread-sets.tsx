/**
 * The component sets in the spread's Components box: Button, PriceCard,
 * Badge, Avatar, Input and Toast, each a labelled box that draws the
 * component's variants at half size. The sets stand in two columns that
 * stack each set under the one before it, so a set never covers its
 * neighbour, whatever its size. Codex has the Button set selected.
 */

import { SiteIcon } from "../parts/icons.js";
import { SiteSelection } from "../parts/selection.js";

import { AcmeSet, type AcmeSetName } from "./acme/acme-sets.js";

/** One component set: its label and its variants. */
interface SpreadSet {
  label: string;
  name: AcmeSetName;
}

/** The sets of each column, from the top. */
const COLUMNS: ReadonlyArray<readonly SpreadSet[]> = [
  [
    { label: "Button", name: "button" },
    { label: "PriceCard", name: "priceCard" },
    { label: "Toast", name: "toast" },
  ],
  [
    { label: "Badge", name: "badge" },
    { label: "Avatar", name: "avatar" },
    { label: "Input", name: "input" },
  ],
];

/** Every component set in its column of the Components box. */
export function SpreadSets() {
  return (
    <div className="site-home-sets">
      {COLUMNS.map((column) => (
        <div className="site-home-sets-column" key={column[0]?.name}>
          {column.map((set) => (
            <div className="site-home-set" key={set.name}>
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
      ))}
    </div>
  );
}
