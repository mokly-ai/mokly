import type { ComponentPageState } from "./component_details.js";
import type { ScreenPageState } from "./screen_preview.js";

interface ComponentMetadata {
  id: string;
  title: string;
  description: string;
  source: string;
}

/** Explicit consumer metadata for synthetic design fixtures. */
export const COMPONENTS = {
  action: {
    id: "action",
    title: "Action",
    description: "A clear next step, shared across screens.",
    source: "components/Action.tsx",
  },
  toolbar: {
    id: "toolbar",
    title: "Toolbar",
    description: "A shared prompt with a single next action.",
    source: "components/Toolbar.tsx",
  },
  "help-hint": {
    id: "help-hint",
    title: "Help hint",
    description: "Contextual help that appears when a reader needs it.",
    source: "components/HelpHint.tsx",
  },
  badge: {
    id: "badge",
    title: "Badge",
    description: "A short label that draws attention to something new.",
    source: "components/Badge.tsx",
  },
} as const satisfies Record<string, ComponentMetadata>;

export type ComponentId = keyof typeof COMPONENTS;

export const COMPONENT_BY_STATE = {
  default: "action",
  disabled: "action",
  comparison: "action",
  affected: "action",
  toolbar: "toolbar",
  hidden: "help-hint",
  unused: "badge",
  added: "badge",
  removed: "action",
  closed: "action",
} as const satisfies Record<ComponentPageState, ComponentId>;

export const SCREENS = {
  welcome: {
    id: "example-welcome",
    title: "Welcome",
    source: "screens/Welcome.tsx",
    description: "A starting point with a clear next action.",
  },
  details: {
    id: "example-details",
    title: "Details",
    source: "screens/Details.tsx",
    description: "Everything needed for the next step.",
  },
  "reading-room": {
    id: "example-reading-room",
    title: "Reading room",
    source: "screens/ReadingRoom.tsx",
    description: "A quiet place to pick up where you left off.",
  },
  farewell: {
    id: "example-farewell",
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
