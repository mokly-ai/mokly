import { defineScreen } from "@mokly/mokly";

import { changesDesignMetadata } from "../../metadata.js";
import { useDarkPreview } from "../../parts/appearance.js";
import { ComparePage, type CompareViewport } from "../../parts/compare_page.js";
import { ComparisonStack, deviceChrome } from "../../parts/compare_stack.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { ENTRY_PATHS, PREVIOUS_PATHS } from "../../parts/entry_paths.js";
import { MiniInvoice } from "../../parts/mini_invoice.js";

/** The comparison's earlier side is the version at the entry's previous path. */
function MovedEvidence() {
  return (
    <p>
      The previous version is the invoice at{" "}
      <code className="mbk-code">{PREVIOUS_PATHS.invoice}</code>, where it was
      before the move.
    </p>
  );
}

/**
 * Invoice moved under Account with edits. Changes keeps one row for it at its
 * new place, labelled Moved, and Overlay compares it with its previous version
 * in one frame; Details names the path it moved from.
 */
function MovedOverlay({ viewport }: { viewport: CompareViewport }) {
  const dark = useDarkPreview();
  return (
    <ComparePage
      activeTitle="Invoice"
      crumbs={["Account", "Billing & Payments"]}
      design={DESTINATIONS.moved}
      evidence={<MovedEvidence />}
      mode="overlay"
      path={ENTRY_PATHS.invoice}
      render={(previewViewport) => (
        <ComparisonStack
          after={<MiniInvoice compact={previewViewport === "mobile"} revised />}
          before={<MiniInvoice compact={previewViewport === "mobile"} />}
          chrome={deviceChrome({
            address: "example.test/invoices/1042",
            dark,
            viewport: previewViewport,
          })}
          mode="overlay"
        />
      )}
      state="changed"
      subject="invoice"
      title="Invoice"
      viewport={viewport}
    />
  );
}

export const movedScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description:
    "A screen that moved with edits keeps one Changes row labelled Moved and compares in Overlay with the version at its previous path.",
  desktop: <MovedOverlay viewport="desktop" />,
  slug: "moved",
  mobile: <MovedOverlay viewport="mobile" />,
  rationale:
    "Moving a folder should not read as deleting one screen and adding another. Each moved entry keeps a single row at its new place, its variant and the document beside it move with it, and the comparison still starts from what the screen looked like before.",
  title: "Moved screen",
});
