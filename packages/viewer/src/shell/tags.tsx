/**
 * The shell's tag controls. These containers read the store and the
 * identifier scope. `@mokly/ui/tag-picker` renders the search field's tag
 * button and its picker, with their roving focus and focus return, and
 * `@mokly/ui/tag-chip` renders each tag chip of an entry's details.
 */

import { TagChip as TagChipView } from "@mokly/ui/tag-chip";
import { TagPicker } from "@mokly/ui/tag-picker";

import { useShellIdentifier } from "./identifier_context.js";
import { useOptionalShellStore, type ShellStore } from "./store_context.js";
import { selectTag } from "./tag_selection.js";

/** Whether a tag filters the catalogue; the parsed query holds lower case. */
function tagSelected(store: ShellStore | undefined, tag: string): boolean {
  return store?.state.selection.tags.includes(tag.toLowerCase()) ?? false;
}

/**
 * One tag chip of an entry's details, synchronized with the shell's parsed
 * query. A choice while the search's picker is open returns focus to the
 * picker's button in the chip's own shell.
 */
export function TagChip({ tag }: { tag: string }) {
  const store = useOptionalShellStore();
  return (
    <TagChipView
      onSelect={(chosen, chip) =>
        selectTag(
          chip,
          () => store?.toggleTag(chosen),
          Boolean(store?.state.tagPickerOpen),
        )
      }
      selected={tagSelected(store, tag)}
      tag={tag}
    />
  );
}

/** The search field's tag button and the picker that it opens. */
export function SearchTagPicker({ tags }: { tags: readonly string[] }) {
  const store = useOptionalShellStore();
  const pickerId = useShellIdentifier("mb-tag-picker");
  return (
    <TagPicker
      focusedIndex={store?.state.tagPickerIndex ?? 0}
      id={pickerId}
      interactive={store?.interactive ?? false}
      onFocusChange={(index) => store?.setTagPicker(true, index)}
      onOpenChange={(open, index) => store?.setTagPicker(open, index)}
      onSelect={(tag) => store?.toggleTag(tag)}
      open={store?.state.tagPickerOpen ?? false}
      tags={tags.map((tag) => ({ selected: tagSelected(store, tag), tag }))}
    />
  );
}
