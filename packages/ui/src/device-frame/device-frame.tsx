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
    <div className="phone-frame mbk-reset">
      <div className="phone-notch mbk-reset" aria-hidden="true" />
      <div className="phone-screen mbk-reset">
        <PhoneStatusBar />
        {children}
      </div>
      <div className="phone-home mbk-reset" aria-hidden="true" />
    </div>
  );
}

/**
 * A desktop browser window whose viewport hosts a desktop preview. An
 * expanded window covers the shell, and the host marks the shell root
 * meanwhile, which shows the scrim below the window. A static depiction that
 * runs no script draws its bar as a picture of itself.
 */
export function BrowserFrame({
  address,
  children,
  expandable = true,
  expanded = false,
  interactive = true,
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
  /**
   * Whether the window's bar acts, as it does by default. A static depiction
   * sets `false`, which draws the address and the toggle as pictures.
   */
  interactive?: boolean;
  /** Receives each press on the address, which asks to copy it. */
  onCopy?: (() => void) | undefined;
  /** Receives the expanded state that the toggle asks for. */
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}) {
  return (
    <div className={`browser-frame${expanded ? " is-expanded" : ""} mbk-reset`}>
      <BrowserBar
        address={address}
        expandable={expandable}
        expanded={expanded}
        interactive={interactive}
        onCopy={onCopy}
        onExpandedChange={onExpandedChange}
      />
      <div className="browser-viewport mbk-reset">{children}</div>
    </div>
  );
}
