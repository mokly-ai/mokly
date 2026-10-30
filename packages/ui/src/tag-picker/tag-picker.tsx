/**
 * The tag button at the end of the catalogue search and the picker that it
 * drops: a toolbar of tag chips with one roving tab stop. The host holds the
 * open state and the focused chip, and each change reaches it through a
 * callback. The button opens and closes the picker, and Escape also closes
 * it. Opening focuses the chip of the first selected tag. The arrow keys,
 * Home, and End move focus between the chips. A close and a chosen tag return
 * focus to the button.
 */

import { useEffect, useRef, type KeyboardEvent } from "react";

import { TagIcon } from "../icons/icons.js";
import { TagChip } from "../tag-chip/tag-chip.js";

/** One tag of the picker, and whether it filters the catalogue. */
export interface TagPickerTag {
  selected: boolean;
  tag: string;
}

/**
 * The chip that a key moves focus to: the arrow keys step and wrap around,
 * and Home and End choose the first and the last chip. Another key moves
 * nothing.
 */
function keyIndex(
  key: string,
  focused: number,
  last: number,
): number | undefined {
  if (key === "ArrowLeft") return focused === 0 ? last : focused - 1;
  if (key === "ArrowRight") return focused === last ? 0 : focused + 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return undefined;
}

export function TagPicker({
  focusedIndex,
  id,
  interactive,
  onFocusChange,
  onOpenChange,
  onSelect,
  open,
  tags,
}: {
  /** The index of the chip that holds focus while the picker is open. */
  focusedIndex: number;
  /** The id of the picker, unique in the document. */
  id: string;
  /**
   * Whether the chips keep one roving tab stop at the focused chip, as they
   * do once a script runs.
   */
  interactive: boolean;
  /** Receives the index of the chip that an arrow key, Home, or End focuses. */
  onFocusChange?: ((index: number) => void) | undefined;
  /**
   * Receives the open state that the button or Escape asks for. An opening
   * also names the chip to focus: the chip of the first selected tag, or the
   * first chip.
   */
  onOpenChange?: ((open: boolean, focusedIndex?: number) => void) | undefined;
  /** Receives each tag that the reader chooses, with its chip. */
  onSelect?: ((tag: string, chip: HTMLButtonElement) => void) | undefined;
  open: boolean;
  /** The tags in their order. Without a tag, nothing renders. */
  tags: readonly TagPickerTag[];
}) {
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const chips =
      panel.current?.querySelectorAll<HTMLButtonElement>("[data-mokly-tag]");
    chips?.[focusedIndex]?.focus();
  }, [focusedIndex, open]);
  if (tags.length === 0) return null;

  // Focus returns after the host's callback, in a microtask.
  const returnFocus = () => queueMicrotask(() => toggle.current?.focus());
  const close = () => {
    onOpenChange?.(false);
    returnFocus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const next = keyIndex(event.key, focusedIndex, tags.length - 1);
    if (next === undefined) return;
    event.preventDefault();
    onFocusChange?.(next);
  };
  return (
    <>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label="Filter by tag"
        className="mbk-search-tag mbk-reset"
        data-mokly-tag-toggle=""
        onClick={() => {
          if (open) close();
          else {
            const selected = tags.findIndex((item) => item.selected);
            onOpenChange?.(true, selected < 0 ? 0 : selected);
          }
        }}
        ref={toggle}
        type="button"
      >
        <TagIcon />
      </button>
      <div
        aria-label="Tags"
        className="mbk-tag-picker mbk-reset"
        data-mokly-tag-picker=""
        hidden={!open}
        id={id}
        ref={panel}
        role="group"
      >
        <div className="mbk-tag-picker-head mbk-reset">Tags</div>
        <span
          aria-label="Tag filters"
          className="mbk-chips mbk-reset"
          onKeyDown={onKeyDown}
          role="toolbar"
        >
          {tags.map((item, index) => (
            <TagChip
              key={item.tag}
              onSelect={(tag, chip) => {
                onSelect?.(tag, chip);
                returnFocus();
              }}
              selected={item.selected}
              tabIndex={
                interactive ? (focusedIndex === index ? 0 : -1) : undefined
              }
              tag={item.tag}
            />
          ))}
        </span>
      </div>
    </>
  );
}
