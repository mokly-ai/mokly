import type { CatalogueTag } from "./tags.js";

/** Product subjects depicted by the design catalogue, independent of link ids. */
export type ScreenSubject = "welcome" | "details" | "farewell" | "welcomeError";

interface SubjectMetadata {
  description: string;
  /** Whether this subject has a published document to reference. */
  docs: boolean;
  generated: string;
  rationale: string;
  schemes: string;
  source: string;
  tags: readonly CatalogueTag[];
  tour: boolean;
}

/** Inspector context for each pictured screen, including the retired example. */
export const SUBJECTS: Record<ScreenSubject, SubjectMetadata> = {
  welcome: {
    description: "A linked landing screen for the neutral fixture.",
    docs: true,
    generated: "screens/welcome.html",
    rationale:
      "The landing screen anchors the example catalogue, so every cross-screen link starts from a known state.",
    schemes: "light, dark",
    source: "entries/catalogue.mockup.tsx",
    tags: ["forms", "onboarding"],
    tour: true,
  },
  details: {
    description: "Additional context for the example catalogue.",
    docs: true,
    generated: "screens/details.html",
    rationale:
      "The Details screen completes the example tour and provides a return to Welcome.",
    schemes: "light, dark",
    source: "entries/catalogue.mockup.tsx",
    tags: ["forms"],
    tour: true,
  },
  farewell: {
    description: "Farewell was removed from the catalogue.",
    docs: false,
    generated: "No current screen",
    rationale:
      "The empty state makes the removal clear while its recorded details remain available.",
    schemes: "light",
    source: "Previous version",
    tags: [],
    tour: false,
  },
  welcomeError: {
    description: "Welcome after saving failed was removed from the catalogue.",
    docs: false,
    generated: "No current screen",
    rationale:
      "A deleted state keeps its recorded details under the screen it belonged to, so the group stays readable after the removal.",
    schemes: "light, dark",
    source: "Previous version",
    tags: ["forms"],
    tour: false,
  },
};
