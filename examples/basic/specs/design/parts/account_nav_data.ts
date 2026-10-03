import type { CatalogueNavigationProps } from "../library/chrome/catalogue-navigation.js";

import { DESTINATIONS } from "./destinations.js";

type NavigationRows = CatalogueNavigationProps["rows"];

/** Whether the Profile row's list of variants and members is disclosed. */
export type ProfileList = "closed" | "open";

/**
 * The Profile screen is its folder's own page, so it renders as the folder's
 * row: a link beside a disclosure whose list holds its Unverified email
 * variant and then the folder's other members, Notifications and Security.
 * No artboard depicts Notifications or the variant, so those rows stay
 * depictions.
 */
function profileRows(list: ProfileList): NavigationRows {
  return [
    {
      key: "profile",
      contents: true,
      depth: 1,
      kind: "screen",
      label: "Profile",
      to: DESTINATIONS.indexEntry,
      variants: list,
    },
    {
      key: "profile-unverified",
      depth: 2,
      kind: "variant",
      label: "Unverified email",
      variantParentKind: "screen",
    },
    {
      key: "profile-notifications",
      depth: 2,
      kind: "screen",
      label: "Notifications",
    },
    {
      key: "profile-security",
      depth: 2,
      kind: "screen",
      label: "Security",
      to: DESTINATIONS.indexMember,
    },
  ];
}

/**
 * The Account area of the depicted catalogue. `Account` takes its title from
 * its slug; `Billing & Payments` takes its title from its folder record,
 * because its slug, `billing`, cannot spell it. Billing holds the Invoice screen
 * with its Overdue variant and the Payment terms document. No artboard depicts
 * Invoice from All, so its row stays a depiction. Profile follows Billing
 * because a folder row sorts before an entry row.
 */
export function accountBranch(profile: ProfileList): NavigationRows {
  return [
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
    ...profileRows(profile),
  ];
}

/**
 * Changes on a branch where only Security changed. Profile is unmodified and
 * its only changed row is a folder member, not a variant, so its row stays a
 * container with no change dot; activating it opens its first changed member.
 */
export const PROFILE_CHANGES_ROWS: NavigationRows = [
  {
    key: "account",
    depth: 0,
    kind: "folder",
    label: "Account",
    open: true,
  },
  {
    key: "profile",
    contents: true,
    depth: 1,
    kind: "screen",
    label: "Profile",
    to: DESTINATIONS.indexMemberChanges,
    variants: "open",
  },
  {
    key: "profile-security",
    changed: true,
    depth: 2,
    kind: "screen",
    label: "Security",
    to: DESTINATIONS.indexMemberChanges,
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
