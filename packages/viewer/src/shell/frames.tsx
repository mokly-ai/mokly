// The realistic device chrome the served shell wraps around every embedded
// screen fragment: a dark-bezel phone with notch, status band, and home pill,
// and a browser window with traffic lights, a monospace address pill carrying
// a copy icon, and the expand-to-overlay toggle handled by the Browse client.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { CollapseIcon, CopyIcon, ExpandIcon } from "./icons.js";
import { PhoneStatusBar } from "./status_bar.js";
import { useOptionalShellStore } from "./store_context.js";

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
  frameKey?: string;
}) {
  const store = useOptionalShellStore();
  const [copied, setCopied] = useState(false);
  const expanded =
    props.frameKey !== undefined &&
    store?.state.expandedFrame === props.frameKey;
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div className={`browser-frame${expanded ? " is-expanded" : ""}`}>
      <div className="browser-bar">
        <span className="lights">
          <i />
          <i />
          <i />
        </span>
        <span
          className="address"
          onClick={() => {
            store?.copy(props.address);
            setCopied(true);
          }}
        >
          <span className="address-url">{props.address}</span>
          <span aria-hidden="true" className="address-copy">
            <CopyIcon />
          </span>
        </span>
        {copied ? <span className="address-copied">URL copied</span> : null}
        {props.expandable !== false ? (
          <button
            aria-expanded={expanded}
            aria-label={
              expanded ? "Collapse viewport" : "Expand to a wider viewport"
            }
            className="browser-expand"
            onClick={() =>
              store?.setExpandedFrame(expanded ? undefined : props.frameKey)
            }
            title={
              expanded ? "Collapse viewport" : "Expand to a wider viewport"
            }
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
