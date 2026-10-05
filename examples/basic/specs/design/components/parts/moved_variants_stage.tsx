import { EmptyState } from "../../parts/stage_content.js";

import { MOVED_VARIANT_LABELS } from "./moved_variants.js";

/**
 * A removed parent whose variants all moved has nothing to compare, so its
 * stage names each variant at its new place instead of a comparison step.
 * No artboard depicts the moved variants, so their links stay depictions.
 */
export function MovedVariantsStage() {
  return (
    <EmptyState
      title="This component was removed"
      body={
        MOVED_VARIANT_LABELS.length === 1
          ? "Its variant moved to a new place."
          : "Its variants moved to new places."
      }
      links={MOVED_VARIANT_LABELS.map((label) => ({ label }))}
    />
  );
}
