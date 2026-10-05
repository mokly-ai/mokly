import { useDesignStyle } from "../style_context.js";

import { tagChip } from "./tag-chip.js";
import type { TagPickerProps } from "./tag-picker.js";

export function TagPickerView({ tags, activeTag }: TagPickerProps) {
  useDesignStyle("tag-picker", tags.length > 0);
  if (!tags.length) return null;
  return (
    <div className="mbk-tag-picker" role="group" aria-label="Tags">
      <div className="mbk-tag-picker-head">Tags</div>
      <span className="mbk-chips">
        {tags.map((tag) => (
          <tagChip.Component
            key={tag.id}
            moklyInstance={tag.id}
            {...tag}
            selected={tag.id === activeTag}
          />
        ))}
      </span>
    </div>
  );
}
