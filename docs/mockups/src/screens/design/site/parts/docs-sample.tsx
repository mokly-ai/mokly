/**
 * The HTML sample fence (decision 10): a band of canvas inside the page
 * frame that sets a guide's HTML sample beside the screen it renders. The
 * source sits in a numbered code panel under the screen's section header,
 * its title as a dark tag and its path as a chip. The rendered screen sits
 * beside it as a drawn frame with its label and size tag, under the
 * viewport and saved-state controls, and a green wire ties a source line to
 * the element that it renders. The band draws one view, Mobile or Desktop,
 * in the Welcome state; `docs-sample-frames.tsx` draws the frames. Below the
 * breakpoint the band stacks the code, the controls and the frame, without
 * the wire.
 */

import { useMockupRenderContext } from "../../../../render-context";

import { classNames } from "./class-names.js";
import { CodePanel } from "./code_panel.js";
import { WELCOME_SCREEN } from "./docs-first-screen-code.js";
import { SampleDesktopFrame, SampleMobileFrame } from "./docs-sample-frames.js";
import { SiteIcon, type SiteIconName } from "./icons.js";
import { SiteChip } from "./labels.js";

/** The viewport whose view the band draws. */
export type SampleView = "mobile" | "desktop";

/** The line that the drawing lights and wires: the heading. */
const LIT_LINE = 12;

/** The line that each view does not render: the other viewport's paragraph. */
const DIMMED_LINE: Readonly<Record<SampleView, number>> = {
  desktop: 14,
  mobile: 15,
};

/**
 * The wire of each view in its 56px-wide box: from the lit line at the code
 * panel's edge to the heading's middle at the frame's edge. The stylesheet
 * places the box and its two ends to match.
 */
const WIRES: Readonly<Record<SampleView, { height: number; path: string }>> = {
  desktop: { height: 291, path: "M0 289.7C28 289.7 28 .8 56 .8" },
  mobile: { height: 257, path: "M0 256.1C28 256.1 28 .8 56 .8" },
};

/**
 * One option of a control: a native radio, drawn as a segment. An option
 * with an icon names itself with hidden text.
 */
function SampleOption({
  checked = false,
  icon,
  label,
  name,
  value,
}: {
  checked?: boolean | undefined;
  icon?: SiteIconName | undefined;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="site-docs-sample-option">
      <input
        className="site-visually-hidden site-docs-sample-input"
        defaultChecked={checked}
        name={name}
        type="radio"
        value={value}
      />
      {icon === undefined ? (
        label
      ) : (
        <>
          <SiteIcon name={icon} size={15} />
          <span className="site-visually-hidden">{label}</span>
        </>
      )}
    </label>
  );
}

/** The viewport and the saved state that the drawn frame shows. */
function SampleControls({ view }: { view: SampleView }) {
  return (
    <div className="site-docs-sample-controls">
      <fieldset aria-label="Viewport" className="site-docs-sample-control">
        <SampleOption
          checked={view === "mobile"}
          icon="phone"
          label="Mobile"
          name="docs-sample-viewport"
          value="mobile"
        />
        <SampleOption
          checked={view === "desktop"}
          icon="desktop"
          label="Desktop"
          name="docs-sample-viewport"
          value="desktop"
        />
      </fieldset>
      <fieldset aria-label="Saved state" className="site-docs-sample-control">
        <SampleOption
          checked
          label="Welcome"
          name="docs-sample-state"
          value="welcome"
        />
        <SampleOption
          label="First visit"
          name="docs-sample-state"
          value="first-visit"
        />
      </fieldset>
    </div>
  );
}

/** The wire from the lit source line to the heading, with its two ends. */
function SampleWire({ view }: { view: SampleView }) {
  const { height, path } = WIRES[view];
  return (
    <span
      className={classNames(
        "site-docs-sample-wire",
        view === "desktop" && "site-docs-sample-wire--desktop",
      )}
    >
      <svg
        fill="none"
        focusable="false"
        height={height}
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox={`0 0 56 ${height}`}
        width="56"
      >
        <path d={path} />
      </svg>
      <span className="site-docs-sample-end site-docs-sample-end--source" />
      <span className="site-docs-sample-end site-docs-sample-end--element" />
    </span>
  );
}

/** The stage: the chosen view's frame, and the wire where the band draws it. */
function SampleStage({ view, wired }: { view: SampleView; wired: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={classNames(
        "site-docs-sample-stage",
        view === "desktop" && "site-docs-sample-stage--desktop",
      )}
    >
      {wired ? <SampleWire view={view} /> : null}
      {view === "mobile" ? <SampleMobileFrame /> : <SampleDesktopFrame />}
    </div>
  );
}

/** The fence for `specs/welcome.screen.html`, as `view` and Welcome. */
export function DocsSample({ view }: { view: SampleView }) {
  const { viewport } = useMockupRenderContext();
  return (
    <div className="site-docs-sample">
      <div aria-hidden="true" className="site-docs-sample-head">
        <span className="site-docs-sample-name">Welcome</span>
        <SiteChip mono>welcome</SiteChip>
      </div>
      <CodePanel
        className="site-docs-sample-code"
        dimmed={[DIMMED_LINE[view]]}
        files={["welcome.screen.html"]}
        language="html"
        lines={WELCOME_SCREEN}
        lit={[LIT_LINE]}
        meta="specs"
        numbered
      />
      <SampleControls view={view} />
      <SampleStage view={view} wired={viewport === "desktop"} />
    </div>
  );
}
