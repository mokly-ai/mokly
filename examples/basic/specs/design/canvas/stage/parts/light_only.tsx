import { canvasScope } from "../../../parts/canvas_palette.js";
import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { NavNode } from "../../../parts/nav.js";
import { PaymentTerms } from "../../../parts/spec_documents.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "../../parts/entries.js";
import { readingFrame, type CanvasFrameSpec } from "../../parts/frames.js";
import { InspectHead } from "../../parts/inspect.js";
import { CANVAS_ALL_ROWS, retarget } from "../../parts/nav_rows.js";

/*
 * The light-only branch, a story of its own: the catalogue rendered Light
 * and Dark at the branch point and renders Light only now, and the branch
 * removed the Action's Compact variant. Compact's previous version keeps its
 * dark render, so the catalogue keeps a dark axis and the shell still offers
 * Dark, while every current document, Payment terms among them, has a light
 * page only. A catalogue row opens only an artboard of this story, so every
 * row but the selected one is a picture.
 */

/**
 * Payment terms on this branch: Changes lists it, because its dark page is
 * gone, and the light page that it shows is unmodified, so it has no status
 * pill. Its panel has the Changes tab, which no artboard shows.
 */
export const LIGHT_ONLY_TERMS: CanvasEntry = {
  ...CANVAS_ENTRIES.paymentTerms,
  status: undefined,
  changed: true,
};

/**
 * The rows of the current entries that the branch changed: each entry that
 * rendered Dark at the branch point, whose dark render is gone, and the use
 * case, whose steps name such a screen.
 */
const CHANGED_ROWS: ReadonlySet<string> = new Set([
  "example-overview",
  "welcome",
  "welcome-empty",
  "welcome-error",
  "details",
  "example/tour",
  "payment-terms",
  ...[COMPONENT_NAVIGATION.action, COMPONENT_NAVIGATION.toolbar].flatMap(
    (component) => [
      component.id,
      ...component.variants.map((variant) => variant.id),
    ],
  ),
]);

/**
 * The branch in All, with Payment terms selected: the row of each changed
 * entry carries the changed mark. Changes counts those thirteen entries and
 * the removed Compact.
 */
export const LIGHT_ONLY_CATALOGUE: CatalogueView = {
  filter: "all",
  activeKey: "payment-terms",
  changedCount: CHANGED_ROWS.size + 1,
  rows: CANVAS_ALL_ROWS.map((row): NavNode => {
    const quiet = retarget(row, undefined);
    return CHANGED_ROWS.has(row.key) ? { ...quiet, changed: true } : quiet;
  }),
};

/**
 * Payment terms as one reading frame that keeps its light page in both
 * appearances, in the Light palette of Mokly's Markdown typography. Under
 * Dark, the frame falls back to that page, and its label says so.
 */
export function lightOnlyTermsFrames(dark: boolean): CanvasFrameSpec[] {
  return [
    {
      ...readingFrame(
        "payment-terms.md",
        <div {...canvasScope("light")} data-cv-light-only="">
          <div className="mbk-markdown">
            <article className="mbk-markdown-body">
              <PaymentTerms />
            </article>
          </div>
        </div>,
        { width: 760, height: 620 },
        "light",
      ),
      ...(dark ? { lightOnly: true } : {}),
    },
  ];
}

/**
 * Inspect of Payment terms on this branch: its head alone, as every
 * document's, without the Moved from row, because it did not move here.
 */
export function LightOnlyTermsInspect() {
  return (
    <InspectHead
      description="When an invoice is due, and what happens once it is late."
      entry={LIGHT_ONLY_TERMS}
      source="specs/account/billing/payment-terms.md"
    />
  );
}
