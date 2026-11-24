/**
 * One compare mode's tile: the mode's icon, its name, and its key in a badge
 * that assistive technology skips, so the tile's name is the mode's name. A
 * tile takes one of three forms: with an address it is a link, which names
 * the shown mode as the current page; otherwise it is a toggle button that
 * reports its mode and names its key as its shortcut, or inert text in a
 * static depiction.
 */

import { CompareModeIcon } from "./compare-icons.js";
import type { CompareMode } from "./compare-modes.js";

export function ModeTile({
  href,
  interactive,
  mode,
  name,
  onMode,
  shortcut,
  shown,
}: {
  href: string | undefined;
  interactive: boolean;
  mode: CompareMode;
  name: string;
  onMode: ((mode: CompareMode) => void) | undefined;
  /** The mode's key, such as `2`. */
  shortcut: string;
  /** Whether the tile's mode is the shown mode. */
  shown: boolean;
}) {
  const body = (
    <>
      <CompareModeIcon mode={mode} />
      <span className="mbk-compare-name mbk-reset">{name}</span>
      <kbd aria-hidden="true" className="mbk-compare-key mbk-reset">
        {shortcut}
      </kbd>
    </>
  );
  if (href !== undefined)
    return (
      <a
        aria-current={shown ? "page" : undefined}
        className="mbk-compare-tile mbk-reset"
        data-diff-mode={mode}
        href={href}
      >
        {body}
      </a>
    );
  if (!interactive)
    return (
      <span
        aria-current={shown ? "page" : undefined}
        className="mbk-compare-tile mbk-reset"
        data-diff-mode={mode}
      >
        {body}
      </span>
    );
  return (
    <button
      aria-keyshortcuts={shortcut}
      aria-pressed={shown}
      className="mbk-compare-tile mbk-reset"
      data-diff-mode={mode}
      onClick={() => onMode?.(mode)}
      type="button"
    >
      {body}
    </button>
  );
}
