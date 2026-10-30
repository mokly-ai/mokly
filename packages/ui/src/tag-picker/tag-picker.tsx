/**
 * The tag button at the end of the catalogue search and the picker that it
 * drops: a toolbar of tag chips with one roving tab stop. The host holds the
 * open state and the focused chip, and each change reaches it through a
 * callback. The button opens and closes the picker, and Escape also closes
 * it. Opening focuses the chip of the first selected tag. The arrow keys,
 * Home, and End move focus between the chips. A close and a chosen tag return
 * focus to the button. A static depiction that runs no script draws the
 * button and the chips as links or pictures, and leaves out a closed picker,
 * which nothing there can open.
 */

import {
  Fragment,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { TagChip } from "../tag-chip/tag-chip.js";

import { TagPickerToggle } from "./tag-picker-toggle.js";

/** One tag of the picker, and whether it filters the catalogue. */
export interface TagPickerTag {
  /** The address that the tag's chip opens in a static depiction. */
  href?: string | undefined;
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

/**
 * The button and the picker. The tags may carry more fields than a tag needs,
 * and each tag's own record reaches `renderChip`.
 */
export function TagPicker<Tag extends TagPickerTag>({
  focusedIndex,
  id,
  interactive,
  onFocusChange,
  onOpenChange,
  onSelect,
  open,
  operable = true,
  renderChip,
  tags,
  toggleHref,
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
  /**
   * Whether the button and each chip without an address are controls, as
   * they are by default. A static depiction that runs no script sets `false`,
   * which draws each of them as a picture of itself.
   */
  operable?: boolean;
  /**
   * Draws each chip in place of the package chip, for a host that renders
   * every chip through its own component, such as a mockup that records each
   * chip. A host's chip takes no roving tab stop and returns no focus.
   */
  renderChip?: ((tag: Tag) => ReactNode) | undefined;
  /** The tags in their order. Without a tag, nothing renders. */
  tags: readonly Tag[];
  /**
   * The address that the button opens, such as another document that shows
   * the picker opened or closed. A button with an address is a link.
   */
  toggleHref?: string | undefined;
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
  // Only the button opens the picker in place. Behind a link or a picture,
  // nothing opens a closed picker, so a static depiction leaves it out.
  const button = toggleHref === undefined && operable;
  return (
    <>
      <TagPickerToggle
        href={toggleHref}
        onToggle={() => {
          if (open) close();
          else {
            const selected = tags.findIndex((item) => item.selected);
            onOpenChange?.(true, selected < 0 ? 0 : selected);
          }
        }}
        open={open}
        operable={operable}
        pickerId={id}
        ref={toggle}
      />
      {open || button ? (
        <div
          aria-label="Tags"
          className="mbk-tag-picker"
          data-mokly-tag-picker=""
          hidden={!open}
          id={id}
          ref={panel}
          role="group"
        >
          <div className="mbk-tag-picker-head">Tags</div>
          <span
            aria-label="Tag filters"
            className="mbk-chips"
            onKeyDown={onKeyDown}
            role="toolbar"
          >
            {tags.map((item, index) =>
              renderChip ? (
                <Fragment key={item.tag}>{renderChip(item)}</Fragment>
              ) : (
                <TagChip
                  href={item.href}
                  interactive={operable}
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
              ),
            )}
          </span>
        </div>
      ) : null}
    </>
  );
}
