/**
 * The Terms and Privacy documents. Both are Markdown files with a title and,
 * once approved text exists, an effective date. The site never invents a
 * date: the document shows one only when its file declares it.
 */

import { z } from "astro/zod";

import { SITE_PATHS, type SitePath } from "./navigation.js";

/** The frontmatter every policy document declares. */
export const legalSchema = z.object({
  effective: z.coerce.date().optional(),
  title: z.string().min(1),
});

/** One policy document's frontmatter. */
export type LegalFrontmatter = z.infer<typeof legalSchema>;

/** The two policies, each naming the route and the one it links across to. */
export const POLICIES = {
  privacy: { cross: "terms", route: SITE_PATHS.privacy },
  terms: { cross: "privacy", route: SITE_PATHS.terms },
} as const;

/** One policy document's identifier. */
export type PolicyId = keyof typeof POLICIES;

/** The route of the policy a document links across to. */
export function crossPolicy(id: PolicyId): {
  readonly label: string;
  readonly route: SitePath;
} {
  const cross = POLICIES[id].cross;
  return {
    label: `${cross.charAt(0).toUpperCase()}${cross.slice(1)}`,
    route: POLICIES[cross].route,
  };
}

const EFFECTIVE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** The effective date as the document shows it, or nothing when unset. */
export function effectiveDate(
  effective: Date | undefined,
): { readonly datetime: string; readonly readable: string } | undefined {
  if (!effective) return undefined;
  const datetime = effective.toISOString().slice(0, 10);
  return { datetime, readable: EFFECTIVE.format(effective) };
}
