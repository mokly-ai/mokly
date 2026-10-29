// The realistic device chrome the served shell wraps around every embedded
// screen fragment: a dark-bezel phone with notch, status band, and home pill,
// and a browser window with traffic lights, a monospace address pill carrying
// a copy icon, and the expand-to-overlay toggle handled by the Browse client.

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { CollapseIcon, CopyIcon, ExpandIcon } from "@mokly/ui/icons";

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
  const latestStore = useRef(store);
  latestStore.current = store;
  const { frameKey } = props;
  const [copied, setCopied] = useState(false);
  const expanded =
    frameKey !== undefined && store?.state.expandedFrame === frameKey;
  // A frame that unmounts while expanded, such as a use-case step that a
  // narrow window replaces with a phone, leaves no page scrim behind.
  useEffect(() => {
    if (frameKey === undefined) return;
    return () => latestStore.current?.releaseExpandedFrame(frameKey);
  }, [frameKey]);
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
              store?.setExpandedFrame(expanded ? undefined : frameKey)
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
