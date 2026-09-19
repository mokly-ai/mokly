import { COMPONENT_NAVIGATION_STATES } from "../components/parts/navigation_states.js";

import {
  DESTINATIONS as D,
  type ComparisonMode,
  type DepictedScheme,
  type DesignDestination,
} from "./destinations.js";
import type { CatalogueTag } from "./tags.js";

interface TagState {
  active: CatalogueTag | null;
  picker: boolean;
}

/** Only authored transitions are present; absence always means a depiction. */
export interface NavigationState {
  inspector?: DesignDestination;
  drawer?: { open: boolean; to: DesignDestination };
  all?: DesignDestination;
  changes?: DesignDestination;
  comparison?: Partial<Record<ComparisonMode, DesignDestination>>;
  scheme?: DepictedScheme;
  schemeLinks?: Partial<Record<DepictedScheme, DesignDestination>>;
  tags?: TagState;
}

const welcomeFilters = { all: D.welcome, changes: D.current };
const detailsFilters = { all: D.details, changes: D.added };
const welcomeModes = {
  current: D.current,
  "side-by-side": D.changed,
  overlay: D.overlay,
  difference: D.difference,
};
const welcomeBrowse: NavigationState = {
  ...welcomeFilters,
  tags: { active: null, picker: false },
};
const appearanceFilters = {
  all: D.appearance,
  changes: D.appearanceSideBySide,
};
const appearanceModes = {
  current: D.appearance,
  "side-by-side": D.appearanceSideBySide,
  difference: D.appearanceDifference,
};

/** Canonical states for the entire design registry, never inferred from labels. */
export const NAVIGATION_STATES: Record<DesignDestination, NavigationState> = {
  ...COMPONENT_NAVIGATION_STATES,
  [D.home]: {},
  [D.page]: {
    inspector: D.pageDetails,
    drawer: { open: false, to: D.pageNavigation },
  },
  [D.pageDetails]: {
    inspector: D.page,
    drawer: { open: false, to: D.pageNavigation },
  },
  [D.pageNavigation]: {
    inspector: D.pageDetails,
    drawer: { open: true, to: D.page },
  },
  [D.pageRemoved]: { all: D.home },
  [D.publication]: {},
  [D.publicationChanges]: {
    all: D.publicationChanges,
    changes: D.current,
    comparison: welcomeModes,
  },
  [D.missing]: {},
  [D.navigation]: {},
  [D.tour]: {},
  [D.welcome]: { ...welcomeBrowse, schemeLinks: { dark: D.darkWelcome } },
  [D.details]: { ...detailsFilters, schemeLinks: { dark: D.darkDetails } },
  [D.inspector]: { ...welcomeBrowse },
  [D.darkWelcome]: {
    ...welcomeFilters,
    scheme: "dark",
    schemeLinks: { light: D.welcome },
  },
  [D.darkDetails]: {
    ...detailsFilters,
    scheme: "dark",
    schemeLinks: { light: D.details },
  },
  [D.appearance]: {
    ...appearanceFilters,
    comparison: appearanceModes,
  },
  [D.appearanceLightOnly]: { ...appearanceFilters },
  [D.appearanceAuto]: { ...appearanceFilters },
  [D.appearanceProps]: { ...appearanceFilters },
  [D.appearanceInstance]: { ...appearanceFilters },
  [D.appearanceDrawer]: {
    ...appearanceFilters,
    drawer: { open: true, to: D.appearance },
  },
  [D.appearanceSideBySide]: {
    ...appearanceFilters,
    comparison: appearanceModes,
  },
  [D.appearanceDifference]: {
    ...appearanceFilters,
    comparison: appearanceModes,
  },
  [D.appearanceHome]: { all: D.appearance },
  [D.appearanceLoading]: { all: D.appearance },
  [D.appearanceError]: { all: D.appearance },
  [D.appearanceUnavailable]: { all: D.appearance },
  [D.appearanceFlow]: { all: D.appearance },
  [D.tagPicker]: {
    ...welcomeBrowse,
    tags: { active: null, picker: true },
  },
  [D.formsPicker]: {
    ...welcomeBrowse,
    tags: { active: "forms", picker: true },
  },
  [D.forms]: {
    ...welcomeBrowse,
    tags: { active: "forms", picker: false },
  },
  [D.onboarding]: {
    ...welcomeBrowse,
    tags: { active: "onboarding", picker: false },
  },
  [D.onboardingPicker]: {
    ...welcomeBrowse,
    tags: { active: "onboarding", picker: true },
  },
  [D.current]: { ...welcomeFilters, comparison: welcomeModes },
  [D.overlay]: { ...welcomeFilters, comparison: welcomeModes },
  [D.changed]: {
    ...welcomeFilters,
    comparison: welcomeModes,
    schemeLinks: { dark: D.darkChanged },
  },
  [D.difference]: { ...welcomeFilters, comparison: welcomeModes },
  [D.added]: { ...detailsFilters },
  [D.removed]: { all: D.home },
  [D.darkChanged]: {
    ...welcomeFilters,
    scheme: "dark",
    schemeLinks: { light: D.changed },
  },
  [D.shared]: { all: D.welcome, changes: D.styleMatched },
  [D.ignored]: { all: D.welcome, changes: D.styleUnresolved },
  [D.empty]: { all: D.welcome },
  [D.styleMatched]: { all: D.styleExcluded, changes: D.styleMatched },
  [D.styleUnresolved]: { all: D.welcome, changes: D.styleUnresolved },
  [D.styleUnnamed]: { all: D.welcome, changes: D.styleUnnamed },
  [D.styleExcluded]: { all: D.styleExcluded, changes: D.empty },
  [D.preparing]: { all: D.welcome },
  [D.unavailable]: { all: D.welcome },
};

/** Open/close preserves the depicted query; a selection closes the picker. */
export function tagPickerTarget(
  tags: TagState | undefined,
): DesignDestination | undefined {
  if (!tags) return undefined;
  if (tags.active === "forms") return tags.picker ? D.forms : D.formsPicker;
  if (tags.active === "onboarding")
    return tags.picker ? D.onboarding : D.onboardingPicker;
  return tags.picker ? D.welcome : D.tagPicker;
}

export function tagTarget(
  tags: TagState | undefined,
  tag: CatalogueTag,
): DesignDestination | undefined {
  if (!tags) return undefined;
  if (tags.active === tag) return D.welcome;
  return tag === "forms" ? D.forms : D.onboarding;
}
