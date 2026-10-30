import { useId } from "react";

import { mockLink } from "@mokly/mokly";

import { TagPicker } from "../../../../../../packages/ui/src/tag-picker/tag-picker.js";

import { tagChip } from "./tag-chip.js";
import type { TagPickerProps } from "./tag-picker.js";

/**
 * The shipped tag picker: the search field's tag button and, while open, the
 * picker that it drops. A static artboard runs no script, so the button links
 * to the artboard that shows the picker opened or closed, or is a picture of
 * itself, and a closed picker draws only its button. Each chip is the
 * registered tag chip, so the picker records its chips.
 */
export function TagPickerView({
  tags,
  activeTag,
  open,
  toggleDestination,
}: TagPickerProps) {
  const id = useId();
  return (
    <TagPicker
      focusedIndex={0}
      id={id}
      interactive={false}
      open={open}
      operable={false}
      renderChip={({ record, selected }) => (
        <tagChip.Component
          moklyInstance={record.id}
          {...record}
          selected={selected}
        />
      )}
      tags={tags.map((record) => ({
        record,
        selected: record.id === activeTag,
        tag: record.label,
      }))}
      toggleHref={
        toggleDestination === undefined
          ? undefined
          : mockLink(toggleDestination)
      }
    />
  );
}
