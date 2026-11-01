import { MetadataRow } from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";

import type { MetadataRowProps } from "./metadata-row.js";

/**
 * The shipped metadata row: a row of the details' metadata column, or a `dt`
 * and `dd` pair inside the caller's `dl`.
 */
export function MetadataRowView({
  label,
  presentation,
  children,
}: MetadataRowProps) {
  return (
    <MetadataRow label={label} presentation={presentation}>
      {children}
    </MetadataRow>
  );
}
