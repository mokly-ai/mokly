import type { CatalogueTag } from "./tags.js";

/** Product subjects depicted by the design catalogue, independent of link ids. */
export type ScreenSubject =
  | "welcome"
  | "details"
  | "farewell"
  | "survey"
  | "invite"
  | "archive"
  | "timeline"
  | "welcomeError";

interface SubjectMetadata {
  description: string;
  generated: string;
  rationale: string;
  /** Whether the entry names a document a reader can still open. */
  relatedDocs: boolean;
  schemes: string;
  source: string;
  tags: readonly CatalogueTag[];
  tour: boolean;
}

const removed = {
  generated: "No current screen",
  relatedDocs: false,
  schemes: "light",
  source: "Previous version",
  tags: [],
  tour: false,
} as const;

/** Inspector context for each pictured screen, including the retired examples. */
export const SUBJECTS: Record<ScreenSubject, SubjectMetadata> = {
  welcome: {
    description: "A linked landing screen for the neutral fixture.",
    generated: "screens/welcome.html",
    rationale:
      "The landing screen anchors the example catalogue, so every cross-screen link starts from a known state.",
    relatedDocs: true,
    schemes: "light, dark",
    source: "entries/catalogue.mockup.tsx",
    tags: ["forms", "onboarding"],
    tour: true,
  },
  details: {
    description: "Additional context for the example catalogue.",
    generated: "screens/details.html",
    rationale:
      "The Details screen completes the example tour and provides a return to Welcome.",
    relatedDocs: true,
    schemes: "light, dark",
    source: "entries/catalogue.mockup.tsx",
    tags: ["forms"],
    tour: true,
  },
  farewell: {
    ...removed,
    description: "Farewell was removed from the catalogue.",
    rationale:
      "The previous version keeps a removed screen readable, so its recorded details describe something the reader can still see.",
  },
  survey: {
    ...removed,
    description: "The reader survey was removed from the catalogue.",
    rationale:
      "A tall previous screen proves the preview keeps the screen's own scrolling instead of cropping it to the frame.",
  },
  invite: {
    ...removed,
    description: "The invite screen was removed from the catalogue.",
    rationale:
      "The previous version is retrieved only when the screen is opened, so the wait belongs on the stage rather than in the navigation.",
  },
  archive: {
    ...removed,
    description: "The archive screen was removed from the catalogue.",
    rationale:
      "A previous version that cannot be loaded must say so and offer another attempt, never substitute current content.",
  },
  timeline: {
    ...removed,
    description: "The timeline was removed from the catalogue.",
    rationale:
      "The timeline was only ever drawn at desktop width, so the stage says which viewport has no previous version instead of leaving that viewport blank.",
  },
  welcomeError: {
    description: "Welcome after saving failed was removed from the catalogue.",
    generated: "No current screen",
    rationale:
      "A deleted state keeps its recorded details under the screen it belonged to, so the group stays readable after the removal.",
    relatedDocs: false,
    schemes: "light, dark",
    source: "Previous version",
    tags: ["forms"],
    tour: false,
  },
};
