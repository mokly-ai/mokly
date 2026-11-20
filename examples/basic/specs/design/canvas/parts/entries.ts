import type { ChangeStatus } from "../../components/parts/comparison_fixtures.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";

import { COMPONENT_IDENTITIES } from "./component_identity.js";

/** The kind of entry a Canvas artboard selects, which decides its frames. */
export type CanvasEntryKind = "component" | "document" | "screen";

/**
 * The selected entry of a Canvas artboard: its title, the last segment of
 * its path, which leads the label of a phone's one frame, its path, its
 * kind, and its change status on the depicted branch.
 */
export interface CanvasEntry {
  title: string;
  slug: string;
  path: string;
  kind: CanvasEntryKind;
  /** The status pill; absent for an unmodified or a moved entry. */
  status?: ChangeStatus | undefined;
  /** Whether the branch changed, added, removed, or moved the entry. */
  changed: boolean;
}

/** The entries that the Canvas artboards select, on the canonical branch. */
export const CANVAS_ENTRIES = {
  welcome: {
    title: "Welcome",
    slug: "welcome",
    path: ENTRY_PATHS.welcome,
    kind: "screen",
    status: "changed",
    changed: true,
  },
  details: {
    title: "Details",
    slug: "details",
    path: ENTRY_PATHS.details,
    kind: "screen",
    status: "added",
    changed: true,
  },
  profile: {
    title: "Profile",
    slug: "profile",
    path: ENTRY_PATHS.profile,
    kind: "screen",
    changed: false,
  },
  action: {
    title: COMPONENT_IDENTITIES.action.title,
    slug: "action",
    path: COMPONENT_IDENTITIES.action.path,
    kind: "component",
    changed: false,
  },
  toolbar: {
    title: COMPONENT_IDENTITIES.toolbar.title,
    slug: "toolbar",
    path: COMPONENT_IDENTITIES.toolbar.path,
    kind: "component",
    changed: false,
  },
  paymentTerms: {
    title: "Payment terms",
    slug: "payment-terms",
    path: ENTRY_PATHS.paymentTerms,
    kind: "document",
    changed: true,
  },
} as const satisfies Record<string, CanvasEntry>;
