/**
 * The HTML sample fence (decision 10): a band of canvas inside the page
 * frame that sets a guide's HTML sample beside the screen it renders. The
 * source sits in a numbered code panel under the screen's section header,
 * its title as a dark tag and its path as a chip. The rendered screen sits
 * beside it as a drawn frame with its label and size tag, under the
 * viewport and saved-state controls, and a green wire ties a source line to
 * the element that it renders. The screen has no CSS, so it keeps the
 * browser's default type. Below the breakpoint the band stacks the code,
 * the controls and the frame, without the wire.
 */

import { useMockupRenderContext } from "../../../../render-context";

import { CodePanel } from "./code_panel.js";
import { WELCOME_SCREEN } from "./docs-first-screen-code.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon, type SiteIconName } from "./icons.js";
import { SiteChip } from "./labels.js";
import { SiteSelection, SiteSizeTag } from "./selection.js";

/** The line that the drawing lights and wires: the heading. */
const LIT_LINE = 12;

/** The line that the chosen mobile view does not render. */
const DIMMED_LINE = 15;

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
function SampleControls() {
  return (
    <div className="site-docs-sample-controls">
      <fieldset aria-label="Viewport" className="site-docs-sample-control">
        <SampleOption
          checked
          icon="phone"
          label="Mobile"
          name="docs-sample-viewport"
          value="mobile"
        />
        <SampleOption
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
function SampleWire() {
  return (
    <span className="site-docs-sample-wire">
      <svg
        fill="none"
        focusable="false"
        height="257"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 56 257"
        width="56"
      >
        <path d="M0 256.1C28 256.1 28 .8 56 .8" />
      </svg>
      <span className="site-docs-sample-end site-docs-sample-end--source" />
      <span className="site-docs-sample-end site-docs-sample-end--element" />
    </span>
  );
}

/**
 * The drawn mobile frame: the phone's status band, then the screen's body
 * in the browser's default type, its heading selected and tagged.
 */
function SampleFrame({ wired }: { wired: boolean }) {
  return (
    <div aria-hidden="true" className="site-docs-sample-stage">
      {wired ? <SampleWire /> : null}
      <div className="site-docs-sample-frame">
        <SiteFrameLabel icon="phone" name="Mobile" />
        <div className="site-docs-sample-screen">
          <div className="site-docs-sample-status">
            <b>9:41</b>
            <span className="site-docs-sample-glyphs">
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className="site-docs-sample-page">
            <div className="site-docs-sample-heading">
              <span className="site-docs-sample-pick">
                Welcome, Ada
                <SiteSelection handles="none" />
                <SiteSizeTag className="site-docs-sample-tag">h1</SiteSizeTag>
              </span>
            </div>
            <div className="site-docs-sample-text">
              Your workspace is ready.
            </div>
            <div className="site-docs-sample-text">Compact navigation</div>
          </div>
        </div>
        <SiteSelection size="390 × 844" />
      </div>
    </div>
  );
}

/** The fence for `specs/welcome.screen.html`, as Mobile and Welcome. */
export function DocsSample() {
  const { viewport } = useMockupRenderContext();
  return (
    <div className="site-docs-sample">
      <div aria-hidden="true" className="site-docs-sample-head">
        <span className="site-docs-sample-name">Welcome</span>
        <SiteChip mono>welcome</SiteChip>
      </div>
      <CodePanel
        className="site-docs-sample-code"
        dimmed={[DIMMED_LINE]}
        files={["welcome.screen.html"]}
        language="html"
        lines={WELCOME_SCREEN}
        lit={[LIT_LINE]}
        meta="specs"
        numbered
      />
      <SampleControls />
      <SampleFrame wired={viewport === "desktop"} />
    </div>
  );
}
