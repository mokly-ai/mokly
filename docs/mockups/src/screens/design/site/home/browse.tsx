/**
 * Frame 02 Changes: the copy beside the GitHub check card, then the depicted
 * viewer on the branch, and the prototype connector that runs from View
 * changes into the viewer's Changes filter. The connector's path follows
 * the rendered places of both ends on each composition; below 1440px the
 * desktop composition draws the connector that fits each width instead.
 *
 * The module keeps its `browse` names in the code and the stylesheets until
 * the site renames them with it; the page shows it as 02 Changes.
 */

import { CheckCard } from "./check-card.js";
import { FitConnector } from "./fit-lines.js";
import { ModuleFrame, ModuleText } from "./module.js";
import { ViewerCompare } from "./viewer-compare.js";
import { Viewer } from "./viewer.js";

/** One end of the connector, in pixels from the module's top-left. */
interface Point {
  x: number;
  y: number;
}

/**
 * The connector on each composition: it leaves the foot of View changes,
 * bends down to just above the viewer bar, and drops onto the top edge of
 * the Changes filter.
 */
const CONNECTOR: Record<
  "mobile" | "desktop",
  { end: Point; start: Point; turn: number }
> = {
  desktop: { end: { x: 175, y: 338 }, start: { x: 1003, y: 189 }, turn: 256 },
  mobile: { end: { x: 255, y: 514 }, start: { x: 176, y: 390 }, turn: 432 },
};

/** The connector from the check card into the viewer. */
function Connector({ viewport }: { viewport: "mobile" | "desktop" }) {
  const { end, start, turn } = CONNECTOR[viewport];
  const bend = (turn - start.y) / 2;
  const path = `M${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${turn - bend}, ${end.x} ${turn} L ${end.x} ${end.y}`;
  return (
    <svg aria-hidden="true" className="site-home-connector" focusable="false">
      <path className="site-home-connector-halo" d={path} />
      <path className="site-home-connector-path" d={path} />
      <circle
        className="site-home-connector-start"
        cx={start.x}
        cy={start.y}
        r="4"
      />
      <path
        className="site-home-connector-path"
        d={`M${end.x - 5} ${end.y - 7} L${end.x} ${end.y} L${end.x + 5} ${end.y - 7}`}
      />
    </svg>
  );
}

/** The Changes module. */
export function BrowseModule({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <article
      aria-labelledby="changes-title"
      className="site-module site-module--browse"
      id="changes"
    >
      <ModuleText
        headingId="changes-title"
        index="02"
        kicker="Changes"
        title="A visual diff for every branch."
      >
        Changes shows what moved, and the check on the pull request counts it.
      </ModuleText>
      <CheckCard />
      <ModuleFrame name="02 Changes">
        <Viewer current="payment" viewport={viewport}>
          <ViewerCompare />
        </Viewer>
        {viewport === "desktop" ? (
          <>
            <FitConnector layout="wide" />
            <FitConnector layout="stacked" />
          </>
        ) : null}
      </ModuleFrame>
      <Connector viewport={viewport} />
    </article>
  );
}
