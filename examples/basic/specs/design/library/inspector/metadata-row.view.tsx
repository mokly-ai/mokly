import { useDesignStyle } from "../style_context.js";

import type { MetadataRowProps } from "./metadata-row.js";

export function MetadataRowView({
  label,
  presentation,
  children,
}: MetadataRowProps) {
  useDesignStyle("metadata-row");
  return presentation === "props" ? (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  ) : (
    <div className="mbk-meta-row">
      <span className="mbk-meta-k">{label}</span>
      <span className="mbk-meta-v">{children}</span>
    </div>
  );
}
