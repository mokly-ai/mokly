/** Accessible tag chips shared by search and entry details. */

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { TagIcon } from "./icons.js";
import { useOptionalShellStore } from "./store_context.js";

/** One tag control synchronized with the shell's parsed query. */
export function TagChip({
  afterSelect,
  pickerIndex,
  tag,
}: {
  afterSelect?: () => void;
  pickerIndex?: number;
  tag: string;
}) {
  const store = useOptionalShellStore();
  const active =
    store?.state.selection.tags.includes(tag.toLowerCase()) ?? false;
  return (
    <button
      aria-pressed={active}
      className={`mbk-chip tag${active ? " active" : ""}`}
      data-mokly-tag={tag}
      onClick={() => {
        store?.toggleTag(tag);
        afterSelect?.();
      }}
      tabIndex={
        pickerIndex === undefined || !store?.interactive
          ? undefined
          : store.state.tagPickerIndex === pickerIndex
            ? 0
            : -1
      }
      type="button"
    >
      <TagIcon size={11} />
      {tag}
    </button>
  );
}

/** Search-field tag button and ephemeral roving-focus picker. */
export function SearchTagPicker({ tags }: { tags: readonly string[] }) {
  const store = useOptionalShellStore();
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = store?.state.tagPickerOpen ?? false;
  useEffect(() => {
    if (!open) return;
    const chips =
      panel.current?.querySelectorAll<HTMLButtonElement>("[data-mokly-tag]");
    chips?.[store?.state.tagPickerIndex ?? 0]?.focus();
  }, [open, store?.state.tagPickerIndex]);
  if (tags.length === 0) return null;

  const close = (focus: boolean) => {
    store?.setTagPicker(false);
    if (focus) queueMicrotask(() => toggle.current?.focus());
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!store) return;
    const last = tags.length - 1;
    let next: number | undefined;
    if (event.key === "ArrowLeft")
      next =
        store.state.tagPickerIndex === 0
          ? last
          : store.state.tagPickerIndex - 1;
    if (event.key === "ArrowRight")
      next =
        store.state.tagPickerIndex === last
          ? 0
          : store.state.tagPickerIndex + 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (next === undefined) return;
    event.preventDefault();
    store.setTagPicker(true, next);
  };
  return (
    <>
      <button
        aria-controls="mb-tag-picker"
        aria-expanded={open}
        aria-label="Filter by tag"
        className="mbk-search-tag"
        data-mokly-tag-toggle=""
        onClick={() => {
          if (open) close(true);
          else {
            const selected = tags.findIndex((tag) =>
              store?.state.selection.tags.includes(tag.toLowerCase()),
            );
            store?.setTagPicker(true, selected < 0 ? 0 : selected);
          }
        }}
        ref={toggle}
        type="button"
      >
        <TagIcon />
      </button>
      <div
        aria-label="Tags"
        className="mbk-tag-picker"
        hidden={!open}
        id="mb-tag-picker"
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
          {tags.map((tag, index) => (
            <TagChip
              afterSelect={() => queueMicrotask(() => toggle.current?.focus())}
              key={tag}
              pickerIndex={index}
              tag={tag}
            />
          ))}
        </span>
      </div>
    </>
  );
}
