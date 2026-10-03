import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

import { DESTINATIONS } from "./destinations.js";

type NavigationRows = CatalogueNavigationProps["rows"];

/**
 * The Account area of the depicted catalogue. `Account` takes its title from
 * its slug; `Billing & Payments` takes its title from its folder record,
 * because its slug, `billing`, cannot spell it. Billing holds the Invoice screen
 * with its Overdue variant and the Payment terms document. No artboard depicts
 * Invoice from All, so its row stays a depiction.
 */
export const ACCOUNT_BRANCH: NavigationRows = [
  {
    key: "account",
    depth: 0,
    kind: "folder",
    label: "Account",
    open: true,
  },
  {
    key: "billing",
    depth: 1,
    kind: "folder",
    label: "Billing & Payments",
    open: true,
  },
  {
    key: "invoice",
    depth: 2,
    kind: "screen",
    label: "Invoice",
    variants: "closed",
  },
  {
    key: "invoice-overdue",
    depth: 3,
    kind: "variant",
    label: "Overdue",
    variantParentKind: "screen",
  },
  {
    key: "payment-terms",
    depth: 2,
    kind: "document",
    label: "Payment terms",
    to: DESTINATIONS.document,
  },
];

/**
 * This branch moved `billing` under `account`. Changes keeps one row per
 * moved entry at its new place, labelled Moved: Invoice moved with edits, and
 * its Overdue variant and the Payment terms document moved unchanged.
 */
export const MOVED_ROWS: NavigationRows = [
  {
    key: "account",
    depth: 0,
    kind: "folder",
    label: "Account",
    open: true,
  },
  {
    key: "billing",
    depth: 1,
    kind: "folder",
    label: "Billing & Payments",
    open: true,
  },
  {
    key: "invoice",
    depth: 2,
    kind: "screen",
    label: "Invoice",
    moved: true,
    to: DESTINATIONS.moved,
    variants: "open",
  },
  {
    key: "invoice-overdue",
    depth: 3,
    kind: "variant",
    label: "Overdue",
    moved: true,
    variantParentKind: "screen",
  },
  {
    key: "payment-terms",
    depth: 2,
    kind: "document",
    label: "Payment terms",
    moved: true,
  },
];

/** Every moved entry counts once in Changes. */
export const MOVED_COUNT = MOVED_ROWS.filter((row) => row.moved).length;
