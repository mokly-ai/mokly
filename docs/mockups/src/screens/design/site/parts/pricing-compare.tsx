/**
 * The comparison, drawn as a component's props table in a frame labelled
 * `Plan · props`: one column for each plan, the rows grouped as a props
 * table groups its sections, and the Team column tinted. A check or a dash
 * is decorative, and the words Included or Not included beside it are read
 * instead. Each group is its own row group under its header. The explicit
 * table roles keep the table's semantics when the mobile composition stacks
 * each row as a property line over three cells.
 */

import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import { SiteChip } from "./labels.js";
import {
  PRICING_COLUMNS,
  PRICING_GROUPS,
  type PricingPlanKey,
  type PricingValue,
} from "./pricing-data.js";

/** The class of a cell in the tinted Team column. */
function columnClass(key: PricingPlanKey): string | undefined {
  return key === "team" ? "site-pricing-props-team" : undefined;
}

/** One plan's value in a cell. */
function Value({ team, value }: { team: boolean; value: PricingValue }) {
  if (value === true)
    return (
      <>
        <SiteIcon className="site-pricing-check" name="check" size={18} />
        <span className="site-visually-hidden">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <span aria-hidden="true" className="site-pricing-dash">
          &#8212;
        </span>
        <span className="site-visually-hidden">Not included</span>
      </>
    );
  if (typeof value === "string") return <>{value}</>;
  if ("token" in value)
    return (
      <SiteChip mono tone={team ? "signal" : "neutral"}>
        {value.token}
      </SiteChip>
    );
  return (
    <>
      {value.lines.map((line) => (
        <span className="site-pricing-line" key={line}>
          {line}{" "}
        </span>
      ))}
      <small>{value.note}</small>
    </>
  );
}

/** The comparison section: its heading and the props table frame. */
export function PricingCompare() {
  return (
    <section
      aria-labelledby="pricing-compare-title"
      className="site-pricing-compare"
    >
      <h2 className="site-pricing-section-title" id="pricing-compare-title">
        Compare the plans.
      </h2>
      <div className="site-pricing-props-frame">
        <SiteFrameLabel icon="component" name="Plan · props" />
        <table className="site-pricing-props" role="table">
          <caption className="site-visually-hidden">
            What each plan includes
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th
                className="site-pricing-props-property"
                role="columnheader"
                scope="col"
              >
                Property
              </th>
              {PRICING_COLUMNS.map((column) => (
                <th
                  className={columnClass(column.key)}
                  key={column.key}
                  role="columnheader"
                  scope="col"
                >
                  <small aria-hidden="true">{column.line}</small>
                  {column.plan}
                </th>
              ))}
            </tr>
          </thead>
          {PRICING_GROUPS.map((group) => (
            <tbody key={group.title} role="rowgroup">
              <tr className="site-pricing-props-group" role="row">
                <th colSpan={4} role="rowheader" scope="rowgroup">
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} role="row">
                  <th role="rowheader" scope="row">
                    {row.label}
                    {row.note === undefined ? null : (
                      <>
                        {" "}
                        <small>{row.note}</small>
                      </>
                    )}
                  </th>
                  {PRICING_COLUMNS.map((column) => (
                    <td
                      className={columnClass(column.key)}
                      key={column.key}
                      role="cell"
                    >
                      <Value
                        team={column.key === "team"}
                        value={row.values[column.key]}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
