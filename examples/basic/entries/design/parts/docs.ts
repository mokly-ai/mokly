import type { CatalogueTag } from "./tags.js";

/** One Markdown doc the depicted catalogue holds, or held before this branch. */
export interface DepictedDoc {
  description: string;
  /** Example id, derived from the doc's file path. */
  id: string;
  /** Folder labels the doc is placed under. */
  location: readonly string[];
  /** The doc's file, relative to the example, as Details lists it. */
  source: string;
  tags: readonly CatalogueTag[];
  title: string;
}

/**
 * The specification doc beside the example screens. Its `onboarding` tag is
 * one the catalogue already declares, so the tag picker keeps its two chips and
 * `tag:onboarding` keeps this doc beside Welcome.
 */
export const WELCOME_SPECIFICATION = {
  description: "What the Welcome screen shows and the states it can be in.",
  id: "welcome-specification",
  location: ["Example"],
  source: "docs/welcome-specification.md",
  tags: ["onboarding"],
  title: "Welcome specification",
} as const satisfies DepictedDoc;

/** The example notes, another current doc the specification relates to. */
export const EXAMPLE_NOTES_SOURCE = "notes.md";

/**
 * A doc this branch removed. Its Guides folder held nothing else, so the
 * folder went with it and only the baseline still names it.
 */
export const NAMING_GUIDE = {
  description:
    "How to name a workspace, before that advice moved into the Welcome specification.",
  id: "naming-guide",
  location: ["Example", "Guides"],
  source: "docs/naming-guide.md",
  tags: ["onboarding"],
  title: "Naming guide",
} as const satisfies DepictedDoc;
