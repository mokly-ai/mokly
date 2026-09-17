// The realistic device chrome the served shell wraps around every embedded
// screen fragment: a dark-bezel phone with notch, status band, and home pill,
// and a browser window with traffic lights, a monospace address pill carrying
// a copy icon, and the expand-to-overlay toggle handled by the Browse client.

import type { ReactNode } from "react";

import { CollapseIcon, CopyIcon, ExpandIcon } from "./icons.js";
import { PhoneStatusBar } from "./status_bar.js";

/** A 390×844 phone body whose screen area hosts the mobile fragment. */
export function PhoneFrame(props: { children?: ReactNode }) {
  return (
    <div className="phone-frame">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        <PhoneStatusBar />
        {props.children}
      </div>
      <div className="phone-home" aria-hidden="true" />
    </div>
  );
}

/** A desktop browser window whose viewport hosts the desktop fragment. */
export function BrowserFrame(props: {
  address: string;
  children?: ReactNode;
  expandable?: boolean;
}) {
  return (
    <div className="browser-frame">
      <div className="browser-bar">
        <span className="lights">
          <i />
          <i />
          <i />
        </span>
        <span className="address">
          <span className="address-url">{props.address}</span>
          <span aria-hidden="true" className="address-copy">
            <CopyIcon />
          </span>
        </span>
        {props.expandable !== false ? (
          <button
            aria-expanded="false"
            aria-label="Expand to a wider viewport"
            className="browser-expand"
            title="Expand to a wider viewport"
            type="button"
          >
            <span aria-hidden="true" className="i-expand">
              <ExpandIcon />
            </span>
            <span aria-hidden="true" className="i-collapse">
              <CollapseIcon />
            </span>
          </button>
        ) : null}
      </div>
      <div className="browser-viewport">{props.children}</div>
    </div>
  );
}
