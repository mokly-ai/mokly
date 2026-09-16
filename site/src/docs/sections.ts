/**
 * The documentation sections, their reading order and their titles. The
 * information architecture in `docs/protocol/site-docs.md` fixes this table:
 * the section tree renders sections in this order and the pages of a section
 * by their `order`, and previous and next follow the same sequence across
 * section boundaries.
 */

/** Every section id a documentation page may declare. */
export const SECTION_IDS = [
  "start",
  "authoring",
  "catalogue",
  "cli",
  "ci",
  "cloud",
  "reference",
  "review",
] as const;

/** One of the fixed documentation section ids. */
export type SectionId = (typeof SECTION_IDS)[number];

/** The title the section tree gives each section. */
export const SECTION_TITLES: Readonly<Record<SectionId, string>> =
  Object.freeze({
    start: "Getting started",
    authoring: "Authoring",
    catalogue: "Catalogue",
    ci: "Continuous integration",
    cli: "CLI reference",
    cloud: "Mokly Cloud",
    reference: "Reference",
    review: "Review and edit",
  });

/** One line describing what a section covers, used by the docs landing. */
export const SECTION_SUMMARIES: Readonly<Record<SectionId, string>> =
  Object.freeze({
    start: "Install Mokly, point it at your screens and open the catalogue.",
    authoring: "Describe screens, components, flows and pages in TypeScript.",
    catalogue: "Browse, search, compare and export what the build produced.",
    ci: "Publish a catalogue from a workflow on every branch.",
    cli: "Every command, the options it takes and what it writes.",
    cloud: "The hosted service: repositories, publications and access.",
    reference: "The contracts an integrator builds against, from the source.",
    review: "Comments, approvals and the agent beside the screen.",
  });

/** The section a page belongs to, or nothing when the id is not a section. */
export function sectionId(value: string): SectionId | undefined {
  return (SECTION_IDS as readonly string[]).includes(value)
    ? (value as SectionId)
    : undefined;
}

/** The position of a section in the reading order. */
export function sectionOrder(section: SectionId): number {
  return SECTION_IDS.indexOf(section);
}
