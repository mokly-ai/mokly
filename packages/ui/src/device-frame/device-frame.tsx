/**
 * The device chrome around a preview: a dark-bezel phone with its notch,
 * status band, and home pill, and a browser window whose bar copies its
 * address and expands the window over the page. The host owns which window
 * is expanded.
 */

import type { ReactNode } from "react";

import { BrowserBar } from "../browser-bar/browser-bar.js";

import { PhoneStatusBar } from "./phone-status.js";

/** A 390×844 phone body whose screen hosts a mobile preview. */
export function PhoneFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="phone-frame">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        <PhoneStatusBar />
        {children}
      </div>
      <div className="phone-home" aria-hidden="true" />
    </div>
  );
}

/**
 * A desktop browser window whose viewport hosts a desktop preview. An
 * expanded window covers the page, and the host marks the page meanwhile.
 */
export function BrowserFrame({
  address,
  children,
  expandable = true,
  expanded = false,
  onCopy,
  onExpandedChange,
}: {
  /** The address that the window shows and copies. */
  address: string;
  children?: ReactNode;
  /** Whether the window offers its expand toggle. */
  expandable?: boolean;
  /** Whether the window is expanded over the page. */
  expanded?: boolean;
  /** Receives each press on the address, which asks to copy it. */
  onCopy?: (() => void) | undefined;
  /** Receives the expanded state that the toggle asks for. */
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}) {
  return (
    <div className={`browser-frame${expanded ? " is-expanded" : ""}`}>
      <BrowserBar
        address={address}
        expandable={expandable}
        expanded={expanded}
        onCopy={onCopy}
        onExpandedChange={onExpandedChange}
      />
      <div className="browser-viewport">{children}</div>
    </div>
  );
}
