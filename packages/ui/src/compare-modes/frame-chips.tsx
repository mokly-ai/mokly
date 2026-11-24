/**
 * The frame chips of Side by side: a group named Compared frame with one chip
 * for each frame that the mode can compare, its kind's glyph before its
 * label. The chosen chip names the compared frame. A chip with an address is
 * a link, which names the chosen frame as the current page; otherwise it is a
 * toggle button that reports its frame, or inert text in a static depiction.
 */

import { CanvasIcon } from "../icons/canvas-icons.js";

import type { CompareFrame } from "./compare-modes.js";

function FrameChip({
  chosen,
  frame,
  href,
  interactive,
  onFrame,
}: {
  chosen: boolean;
  frame: CompareFrame;
  href: string | undefined;
  interactive: boolean;
  onFrame: ((key: string) => void) | undefined;
}) {
  const content = (
    <>
      <CanvasIcon name={frame.kind} size={12} />
      {frame.label}
    </>
  );
  if (href !== undefined)
    return (
      <a
        aria-current={chosen ? "page" : undefined}
        className="mbk-compare-chip mbk-reset"
        data-diff-frame={frame.key}
        href={href}
      >
        {content}
      </a>
    );
  if (!interactive)
    return (
      <span
        aria-current={chosen ? "page" : undefined}
        className="mbk-compare-chip mbk-reset"
        data-diff-frame={frame.key}
      >
        {content}
      </span>
    );
  return (
    <button
      aria-pressed={chosen}
      className="mbk-compare-chip mbk-reset"
      data-diff-frame={frame.key}
      onClick={() => onFrame?.(frame.key)}
      type="button"
    >
      {content}
    </button>
  );
}

export function FrameChips({
  frame,
  frameHref,
  frames,
  interactive,
  onFrame,
}: {
  /** The key of the compared frame. */
  frame: string | undefined;
  frameHref: ((key: string) => string | undefined) | undefined;
  frames: readonly CompareFrame[];
  interactive: boolean;
  onFrame: ((key: string) => void) | undefined;
}) {
  return (
    <div
      aria-label="Compared frame"
      className="mbk-compare-chips mbk-reset"
      role="group"
    >
      {frames.map((item) => (
        <FrameChip
          chosen={item.key === frame}
          frame={item}
          href={frameHref?.(item.key)}
          interactive={interactive}
          key={item.key}
          onFrame={onFrame}
        />
      ))}
    </div>
  );
}
