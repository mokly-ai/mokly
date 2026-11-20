/**
 * The legal documents. Each is a Markdown file with a title and effective
 * date; this module owns their identifiers, labels and routes.
 */

import { z } from "astro/zod";

import { SITE_PATHS, type SitePath } from "./navigation.js";

/** The frontmatter every policy document declares. */
export const legalSchema = z.object({
  effective: z.coerce.date(),
  title: z.string().min(1),
});

/** One policy document's frontmatter. */
export type LegalFrontmatter = z.infer<typeof legalSchema>;

/** The legal documents in their shared navigation order. */
export const POLICIES = {
  terms: { label: "Terms", route: SITE_PATHS.terms },
  privacy: { label: "Privacy", route: SITE_PATHS.privacy },
  complaints: { label: "Complaints", route: SITE_PATHS.complaints },
  security: { label: "Security", route: SITE_PATHS.security },
} as const;

/** One policy document's identifier. */
export type PolicyId = keyof typeof POLICIES;

/** One link from a legal document to another legal document. */
export interface PolicyLink {
  readonly label: string;
  readonly route: SitePath;
}

/** Every other legal document in shared navigation order. */
export function relatedPolicies(id: PolicyId): readonly PolicyLink[] {
  return (Object.keys(POLICIES) as PolicyId[])
    .filter((candidate) => candidate !== id)
    .map((candidate) => POLICIES[candidate]);
}

const EFFECTIVE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** The effective date as the document shows it. */
export function effectiveDate(effective: Date): {
  readonly datetime: string;
  readonly readable: string;
} {
  const datetime = effective.toISOString().slice(0, 10);
  return { datetime, readable: EFFECTIVE.format(effective) };
}
