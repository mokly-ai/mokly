/** Navigation-only destinations alongside the ordinary preview's real source modules. */
export const ordinaryPreviewFixtureSource = `import { definePage } from "@mokly/mokly";
import { DESTINATIONS } from "../specs/design/parts/destinations.js";
import { INTERACTIVE_PAGES } from "../specs/design/interactive/parts/destinations.js";
import { COMPONENT_PAGES, CONTROLS_PAGES, INSPECTION_PAGES } from "../specs/design/components/parts/destinations.js";

const existing = new Set([
  DESTINATIONS.home, DESTINATIONS.exampleOverview, DESTINATIONS.welcome,
  DESTINATIONS.welcomeAppearanceVariant, DESTINATIONS.detailsAppearanceVariant,
  DESTINATIONS.details, DESTINATIONS.tour, DESTINATIONS.tagPicker,
  DESTINATIONS.forms, DESTINATIONS.onboarding, DESTINATIONS.onboardingPicker,
  DESTINATIONS.document, DESTINATIONS.page, DESTINATIONS.pageDetails,
  DESTINATIONS.pageNavigation, DESTINATIONS.pageRemoved,
]);
export const mockups = [...new Set([
  ...Object.values(INTERACTIVE_PAGES),
  ...Object.values(DESTINATIONS), ...Object.values(COMPONENT_PAGES),
  ...Object.values(CONTROLS_PAGES), ...Object.values(INSPECTION_PAGES),
])].filter((path) => !existing.has(path)).map((path) => definePage({
  path, slug: "index", title: path, description: "Navigation-only fixture destination",
  dependencies: [], relatedDocs: [],
  render: () => "<!doctype html><html><body><main>" + path + "</main></body></html>",
}));
`;
