import { INSPECTION_PAGES } from "../../parts/destinations.js";
import { welcomeInstances } from "../../parts/fixtures.js";
import { SCREENS } from "../../parts/metadata.js";

export type WelcomeInstance = (typeof welcomeInstances)[number];

export interface ComponentGroup {
  component: WelcomeInstance["component"];
  instances: readonly WelcomeInstance[];
}

const destinations = {
  main: INSPECTION_PAGES["toolbar-selection"],
  "toolbar-action": INSPECTION_PAGES.nested,
  "footer-action": INSPECTION_PAGES.details,
  help: INSPECTION_PAGES["help-selection"],
} as const satisfies Record<WelcomeInstance["id"], string>;

export const screenTitle = SCREENS.welcome.title;
export const instanceCount = welcomeInstances.length;
export const componentCount = new Set(
  welcomeInstances.map((instance) => instance.component),
).size;
export const panelSummary = `${instanceCount} instances · ${componentCount} components`;
export const rootInstances = welcomeInstances.filter(
  (instance) => instance.parent === null,
);

export const componentGroups: readonly ComponentGroup[] = [
  ...new Set(welcomeInstances.map((instance) => instance.component)),
]
  .map((component) => ({
    component,
    instances: welcomeInstances.filter(
      (instance) => instance.component === component,
    ),
  }))
  .sort((left, right) => right.instances.length - left.instances.length);

export function childrenFor(instance: WelcomeInstance) {
  return welcomeInstances.filter((child) => child.parent === instance.id);
}

export function destinationFor(instance: WelcomeInstance) {
  return destinations[instance.id];
}

export function ownerFor(instance: WelcomeInstance) {
  if (instance.parent === null) return screenTitle;
  const parent = welcomeInstances.find(
    (candidate) => candidate.id === instance.parent,
  );
  return parent ? `${parent.component} · ${parent.label}` : screenTitle;
}

export function locationFor(instance: WelcomeInstance) {
  if (instance.parent === null) return screenTitle;
  const parent = welcomeInstances.find(
    (candidate) => candidate.id === instance.parent,
  );
  return parent
    ? `Inside ${parent.label} ${parent.component.toLowerCase()}`
    : screenTitle;
}

export function countFor(instance: WelcomeInstance) {
  return welcomeInstances.filter(
    (candidate) => candidate.component === instance.component,
  ).length;
}

export function ordinalFor(instance: WelcomeInstance) {
  return (
    welcomeInstances
      .filter((candidate) => candidate.component === instance.component)
      .findIndex((candidate) => candidate.id === instance.id) + 1
  );
}

export function countLabel(count: number) {
  return `${count} ${count === 1 ? "instance" : "instances"}`;
}
