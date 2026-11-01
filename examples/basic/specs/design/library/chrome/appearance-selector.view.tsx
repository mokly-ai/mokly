import { useId } from "react";

import { AppearanceSelector } from "../../../../../../packages/ui/src/appearance-selector/appearance-selector.js";

import type { AppearanceSelectorProps } from "./appearance-selector.js";

/**
 * The shipped Appearance control. Its wrapper carries the compact flag, which
 * this component's stylesheet draws as the narrow face at every width.
 */
export function AppearanceSelectorView({
  value,
  compact,
  otherSchemeChanged,
}: AppearanceSelectorProps) {
  const changedId = useId();
  return (
    <span
      className="mbk-appearance-frame"
      data-compact={compact ? "" : undefined}
    >
      <AppearanceSelector
        changed={otherSchemeChanged ?? false}
        changedId={changedId}
        changedText="Other theme changed"
        value={value}
      />
    </span>
  );
}
