/** Navigation-only destinations alongside the ordinary preview's real source modules. */
export const ordinaryPreviewFixtureSource = `import { definePage } from "@mokly/mokly";
import { DESTINATIONS } from "../specs/design/parts/destinations.js";
import { COMPONENT_PAGES, CONTROLS_PAGES, INSPECTION_PAGES } from "../specs/design/components/parts/destinations.js";

const existing = new Set([
  DESTINATIONS.home, DESTINATIONS.welcome, DESTINATIONS.details, DESTINATIONS.tagPicker,
  DESTINATIONS.onboarding, DESTINATIONS.onboardingPicker,
  DESTINATIONS.welcomeAppearanceVariant, DESTINATIONS.detailsAppearanceVariant, DESTINATIONS.forms,
  DESTINATIONS.page, DESTINATIONS.pageDetails,
]);
export const mockups = [...new Set([
  ...Object.values(DESTINATIONS), ...Object.values(COMPONENT_PAGES),
  ...Object.values(CONTROLS_PAGES), ...Object.values(INSPECTION_PAGES),
])].filter((path) => !existing.has(path)).map((path) => definePage({
  path, slug: "index", title: path, description: "Navigation-only fixture destination",
  dependencies: [], relatedDocs: [],
  render: () => "<!doctype html><html><body><main>" + path + "</main></body></html>",
}));
`;
