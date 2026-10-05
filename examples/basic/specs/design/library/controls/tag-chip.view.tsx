import { MockLink } from "@mokly/mokly";

import { TagIcon } from "../../parts/icons.js";
import { useDesignStyle } from "../style_context.js";

import type { TagChipProps } from "./tag-chip.js";

export function TagChipView({ label, selected, destination }: TagChipProps) {
  useDesignStyle("tag-chip");
  const className = selected ? "mbk-chip tag active" : "mbk-chip tag";
  const content = (
    <>
      <TagIcon size={11} />
      {label}
    </>
  );
  return destination ? (
    <MockLink to={destination} className={className}>
      {content}
    </MockLink>
  ) : (
    <span className={className}>{content}</span>
  );
}
