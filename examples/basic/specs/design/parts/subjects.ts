import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { PREVIOUS_PATHS } from "./entry_paths.js";
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
  | "welcomeError"
  | "welcomeErrorReparented"
  | "invoice"
  | "profile"
  | "profileSecurity";

interface SubjectMetadata {
  description: string;
  /** The path a moved entry had at the branch point. */
  previousPath?: string;
  rationale: string;
  /** A related document that is itself a catalogue entry, opened by its row. */
  relatedDocument?: { title: string; to: DesignDestination };
  /** Whether the entry names a document a reader can still open. */
  relatedDocs: boolean;
  schemes: string;
  source: string;
  tags: readonly CatalogueTag[];
  tour: boolean;
}

const removed = {
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
    rationale:
      "The landing screen anchors the example catalogue, so every cross-screen link starts from a known state.",
    relatedDocs: true,
    schemes: "light, dark",
    source: "specs/catalogue.tsx",
    tags: ["forms", "onboarding"],
    tour: true,
  },
  details: {
    description: "Additional context for the example catalogue.",
    rationale:
      "The Details screen completes the example tour and provides a return to Welcome.",
    relatedDocs: true,
    schemes: "light, dark",
    source: "specs/catalogue.tsx",
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
    rationale:
      "A deleted state keeps its recorded details under the screen it belonged to, so the group stays readable after the removal.",
    relatedDocs: false,
    schemes: "light, dark",
    source: "Previous version",
    tags: ["forms"],
    tour: false,
  },
  invoice: {
    description:
      "An invoice with its line items, the amount due, and a way to pay.",
    previousPath: PREVIOUS_PATHS.invoice,
    rationale:
      "Customers open an invoice to see what they owe and pay it, so the amount due and the payment action come first.",
    relatedDocument: { title: "Payment terms", to: DESTINATIONS.document },
    relatedDocs: false,
    schemes: "light",
    source: "specs/account/billing/invoice.mockup.tsx",
    tags: [],
    tour: false,
  },
  profile: {
    description:
      "The account holder's name, email address, and photo, with the settings kept beside them.",
    rationale:
      "The profile is the Profile folder's own page, so it leads the folder: its row opens the profile and lists the security and notification settings after its own variant.",
    relatedDocs: false,
    schemes: "light",
    source: "specs/account/profile/index.mockup.tsx",
    tags: [],
    tour: false,
  },
  profileSecurity: {
    description: "The password, two-step sign-in, and signed-in devices.",
    rationale:
      "Security settings live in the Profile folder, so the profile's row lists them and their breadcrumbs end in the profile it belongs to.",
    relatedDocs: false,
    schemes: "light",
    source: "specs/account/profile/security.mockup.tsx",
    tags: [],
    tour: false,
  },
  welcomeErrorReparented: {
    description: "Welcome after saving failed was removed from the catalogue.",
    rationale:
      "Welcome is now another screen's variant, so this removed state stays as one flat Changes row instead of nesting a second variant level.",
    relatedDocs: false,
    schemes: "light, dark",
    source: "Previous version",
    tags: ["forms"],
    tour: false,
  },
};
