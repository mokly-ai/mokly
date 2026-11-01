/**
 * The bar of a desktop browser window: its traffic lights, the address pill
 * that copies its address, and the toggle that expands the window over the
 * page. A press on the address asks the host to copy it and shows "URL
 * copied" for a moment. The host owns which window is expanded. A static
 * depiction that runs no script draws the bar as a picture of itself.
 */

import { useEffect, useState } from "react";

import { CollapseIcon, CopyIcon, ExpandIcon } from "../icons/icons.js";

/** How long the "URL copied" message shows, in milliseconds. */
const COPIED_MESSAGE_MS = 1400;

/** The toggle's two glyphs, of which the stylesheet shows one. */
function ToggleGlyphs() {
  return (
    <>
      <span aria-hidden="true" className="i-expand mbk-reset">
        <ExpandIcon />
      </span>
      <span aria-hidden="true" className="i-collapse mbk-reset">
        <CollapseIcon />
      </span>
    </>
  );
}

export function BrowserBar({
  address,
  expandable = true,
  expanded = false,
  interactive = true,
  onCopy,
  onExpandedChange,
}: {
  /** The address that the bar shows and copies. */
  address: string;
  /** Whether the bar offers the toggle that expands its window. */
  expandable?: boolean;
  /** Whether the window is expanded over the page. */
  expanded?: boolean;
  /**
   * Whether the bar acts, as it does by default. A static depiction that
   * runs no script sets `false`: the address then copies nothing, and the
   * toggle is a picture of itself.
   */
  interactive?: boolean;
  /** Receives each press on the address, which asks to copy it. */
  onCopy?: (() => void) | undefined;
  /** Receives the expanded state that the toggle asks for. */
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const toggle = expanded ? "Collapse viewport" : "Expand to a wider viewport";
  return (
    <div
      className="browser-bar mbk-reset"
      data-browser-static={interactive ? undefined : ""}
    >
      <span className="lights mbk-reset">
        <i className="mbk-reset" />
        <i className="mbk-reset" />
        <i className="mbk-reset" />
      </span>
      <span
        className="address mbk-reset"
        onClick={
          interactive
            ? () => {
                onCopy?.();
                setCopied(true);
              }
            : undefined
        }
      >
        <span className="address-url mbk-reset">{address}</span>
        <span aria-hidden="true" className="address-copy mbk-reset">
          <CopyIcon />
        </span>
      </span>
      {copied ? (
        <span className="address-copied mbk-reset">URL copied</span>
      ) : null}
      {!expandable ? null : interactive ? (
        <button
          aria-expanded={expanded}
          aria-label={toggle}
          className="browser-expand mbk-reset"
          onClick={() => onExpandedChange?.(!expanded)}
          title={toggle}
          type="button"
        >
          <ToggleGlyphs />
        </button>
      ) : (
        <span
          aria-label={toggle}
          className="browser-expand mbk-reset"
          role="img"
          title={toggle}
        >
          <ToggleGlyphs />
        </span>
      )}
    </div>
  );
}
