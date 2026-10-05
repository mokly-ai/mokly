import type { ReactNode } from "react";

import { useDesignInstance } from "../library/composition.js";
import { metadataRow } from "../library/inspector/metadata-row.js";

export function MetaRow({
  children,
  label,
  name,
  presentation = "metadata",
}: {
  children: ReactNode;
  label: string;
  name: string;
  presentation?: "metadata" | "props";
}) {
  return (
    <metadataRow.Component
      moklyInstance={useDesignInstance(name)}
      label={label}
      presentation={presentation}
    >
      {children}
    </metadataRow.Component>
  );
}
