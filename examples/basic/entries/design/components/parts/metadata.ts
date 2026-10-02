import type { ComponentPageState } from "./component_details.js";
import type { ScreenPageState } from "./screen_preview.js";

interface ComponentMetadata {
  id: string;
  title: string;
  description: string;
  source: string;
  dependencies: readonly string[];
}

/** Explicit consumer metadata for synthetic design fixtures. */
export const COMPONENTS = {
  action: {
    id: "action",
    title: "Action",
    description: "A clear next step, shared across screens.",
    source: "components/Action.tsx",
    dependencies: ["components/Action.tsx"],
  },
  toolbar: {
    id: "toolbar",
    title: "Toolbar",
    description: "A shared prompt with a single next action.",
    source: "components/Toolbar.tsx",
    dependencies: ["components/Toolbar.tsx"],
  },
  "help-hint": {
    id: "help-hint",
    title: "Help hint",
    description: "Contextual help that appears when a reader needs it.",
    source: "components/HelpHint.tsx",
    dependencies: ["components/HelpHint.tsx"],
  },
  badge: {
    id: "badge",
    title: "Badge",
    description: "A short label that draws attention to something new.",
    source: "components/Badge.tsx",
    dependencies: ["components/Badge.tsx"],
  },
  checklist: {
    id: "checklist",
    title: "Checklist",
    description: "The steps to finish before starting, in order.",
    source: "components/Checklist.tsx",
    dependencies: ["components/Checklist.tsx"],
  },
} as const satisfies Record<string, ComponentMetadata>;

export type ComponentId = keyof typeof COMPONENTS;

/** Identity shown by one parent or component-variant page mockup. */
export interface ComponentEntryMetadata {
  component: ComponentId;
  /** The entry's path: its folders, the component's slug, then any variant. */
  path: string;
  title: string;
  variantOf?: ComponentId;
}

/** Parent and variant identities used across component-page design states. */
export const COMPONENT_ENTRIES = {
  action: {
    component: "action",
    path: "example/components/action",
    title: "Action",
  },
  actionDefault: {
    component: "action",
    path: "example/components/action/default",
    title: "Default",
    variantOf: "action",
  },
  actionDisabled: {
    component: "action",
    path: "example/components/action/disabled",
    title: "Disabled",
    variantOf: "action",
  },
  actionCompact: {
    component: "action",
    path: "example/components/action/compact",
    title: "Compact",
    variantOf: "action",
  },
  toolbar: {
    component: "toolbar",
    path: "example/components/toolbar",
    title: "Toolbar",
  },
  helpHint: {
    component: "help-hint",
    path: "example/components/help-hint",
    title: "Help hint",
  },
  badge: {
    component: "badge",
    path: "example/components/badge",
    title: "Badge",
  },
  badgeDefault: {
    component: "badge",
    path: "example/components/badge/default",
    title: "Default",
    variantOf: "badge",
  },
  checklist: {
    component: "checklist",
    path: "example/components/checklist",
    title: "Checklist",
  },
  checklistDefault: {
    component: "checklist",
    path: "example/components/checklist/default",
    title: "Default",
    variantOf: "checklist",
  },
} as const satisfies Record<string, ComponentEntryMetadata>;

export const COMPONENT_ENTRY_BY_STATE = {
  default: COMPONENT_ENTRIES.action,
  disabled: COMPONENT_ENTRIES.actionDisabled,
  comparison: COMPONENT_ENTRIES.actionDefault,
  overlay: COMPONENT_ENTRIES.actionDefault,
  difference: COMPONENT_ENTRIES.actionDefault,
  "overlay-tall": COMPONENT_ENTRIES.checklistDefault,
  affected: COMPONENT_ENTRIES.actionDefault,
  toolbar: COMPONENT_ENTRIES.toolbar,
  hidden: COMPONENT_ENTRIES.helpHint,
  unused: COMPONENT_ENTRIES.badge,
  added: COMPONENT_ENTRIES.badgeDefault,
  removed: COMPONENT_ENTRIES.actionCompact,
  "shared-impact": COMPONENT_ENTRIES.action,
  closed: COMPONENT_ENTRIES.action,
} as const satisfies Record<ComponentPageState, ComponentEntryMetadata>;

export const SCREENS = {
  welcome: {
    path: "example/screens/welcome",
    title: "Welcome",
    source: "screens/Welcome.tsx",
    description: "A starting point with a clear next action.",
  },
  details: {
    path: "example/screens/details",
    title: "Details",
    source: "screens/Details.tsx",
    description: "Everything needed for the next step.",
  },
  "reading-room": {
    path: "example/screens/reading-room",
    title: "Reading room",
    source: "screens/ReadingRoom.tsx",
    description: "A quiet place to pick up where you left off.",
  },
  farewell: {
    path: "example/screens/farewell",
    title: "Farewell",
    source: "screens/Farewell.tsx",
    description: "A former screen that is no longer in the catalogue.",
  },
} as const;

export type ScreenId = keyof typeof SCREENS;
export type CatalogueIdentity = ComponentId | ScreenId;

export function screenIdentity(state: ScreenPageState): ScreenId {
  if (state === "empty" || state === "unavailable") return "reading-room";
  if (state === "consumer") return "details";
  if (state === "removed-consumer") return "farewell";
  return "welcome";
}
