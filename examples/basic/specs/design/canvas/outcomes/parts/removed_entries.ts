import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { REMOVED_SCREENS } from "../../../parts/nav_data.js";
import type { CatalogueTag } from "../../../parts/tags.js";
import type { CanvasEntry } from "../../parts/entries.js";

/**
 * A removed entry as its artboards show it: the entry that the section head
 * names, the key of its row in the Changes filter, and the metadata of its
 * base-commit record, which Inspect keeps: the description, the rationale of
 * a screen, the source file, the schemes of its historical views, the
 * folders that held it, and its tags.
 */
export interface RemovedRecord {
  entry: CanvasEntry;
  key: string;
  description: string;
  rationale?: string | undefined;
  source: string;
  schemes: "light" | "light, dark";
  location: string;
  tags?: readonly CatalogueTag[] | undefined;
}

/** A removed entry, which keeps its Removed status and its Changes tab. */
function removed(
  title: string,
  path: string,
  kind: CanvasEntry["kind"],
): CanvasEntry {
  return {
    title,
    slug: path.slice(path.lastIndexOf("/") + 1),
    path,
    kind,
    status: "removed",
    changed: true,
  };
}

/** A screen that the canonical branch removed, by its row on that branch. */
function removedScreen(
  screen: (typeof REMOVED_SCREENS)[keyof typeof REMOVED_SCREENS],
  record: Pick<RemovedRecord, "description" | "rationale">,
): RemovedRecord {
  return {
    ...record,
    entry: removed(screen.title, screen.path, "screen"),
    key: screen.key,
    source: "specs/catalogue.tsx",
    schemes: "light",
    location: "Example › Screens",
  };
}

/**
 * The five screens that the canonical branch removed. Their views were
 * captured before the catalogue enabled Dark, so each has Light views only,
 * and Timeline was only ever drawn at desktop width.
 */
export const REMOVED_SCREEN_RECORDS = {
  farewell: removedScreen(REMOVED_SCREENS.farewell, {
    description: "A closing screen that thanks the reader for looking around.",
    rationale:
      "The catalogue needs a clear end, so the last screen says that everything the reader opened stays in the navigation.",
  }),
  survey: removedScreen(REMOVED_SCREENS.survey, {
    description: "Six short questions about the example catalogue.",
    rationale:
      "Readers answer in one sitting, so every question shares one long screen.",
  }),
  invite: removedScreen(REMOVED_SCREENS.invite, {
    description: "An invitation to share the catalogue with a teammate.",
    rationale:
      "Sharing starts from one screen, so the invitation asks only for an address.",
  }),
  archive: removedScreen(REMOVED_SCREENS.archive, {
    description: "The screens that the catalogue stopped showing.",
    rationale:
      "Older screens stay findable in one place instead of crowding the navigation.",
  }),
  timeline: removedScreen(REMOVED_SCREENS.timeline, {
    description: "A year of the example catalogue, season by season.",
    rationale:
      "The seasons read across a wide screen, so the timeline was drawn for desktop only.",
  }),
} as const satisfies Record<string, RemovedRecord>;

/**
 * Welcome's saved variant Save failed, which a branch of its own removed. It
 * rendered in both schemes, so its previous version has four views.
 */
export const REMOVED_VARIANT_RECORD: RemovedRecord = {
  entry: removed("Save failed", ENTRY_PATHS.welcomeError, "screen"),
  key: "welcome-error",
  description: "Welcome after its workspace could not be saved.",
  rationale:
    "A failed save keeps the reader on Welcome, with the error above the heading, so they can try again.",
  source: "specs/catalogue.tsx",
  schemes: "light, dark",
  location: "Example › Screens",
  tags: ["forms"],
};

/** A handbook page that the handbook branch removed with its folder. */
function removedPage(
  title: string,
  slug: string,
  description: string,
): RemovedRecord {
  const path = `example/handbook/${slug}`;
  return {
    entry: removed(title, path, "document"),
    key: path,
    description,
    source: "specs/example/handbook.tsx",
    schemes: "light",
    location: "Example › Handbook",
  };
}

/**
 * The four pages of the Handbook folder, which a branch of its own removed
 * with the folder. A page is light only.
 */
export const REMOVED_PAGE_RECORDS = {
  gettingStarted: removedPage(
    "Getting started",
    "getting-started",
    "A handbook to accompany the example screens.",
  ),
  fieldGuide: removedPage(
    "Field guide",
    "field-guide",
    "The long companion to the handbook, read section by section.",
  ),
  printingTips: removedPage(
    "Printing tips",
    "printing-tips",
    "Notes on printing the example catalogue.",
  ),
  styleNotes: removedPage(
    "Style notes",
    "style-notes",
    "House style for the example writing.",
  ),
} as const satisfies Record<string, RemovedRecord>;

/** The file that the four removed pages came from, which labels their frame. */
export const HANDBOOK_FILE = "handbook.tsx";

/**
 * The Payment terms document, which a branch of its own removed after the
 * catalogue enabled Dark. It was captured before that, so its previous
 * version has a light render only.
 */
export const LIGHT_ONLY_RECORD: RemovedRecord = {
  entry: removed("Payment terms", ENTRY_PATHS.paymentTerms, "document"),
  key: "payment-terms",
  description: "When an invoice is due, and what happens once it is late.",
  source: "specs/account/billing/payment-terms.md",
  schemes: "light",
  location: "Account › Billing & Payments",
};
