/**
 * The documentation frontmatter contract from `docs/protocol/site-docs.md`.
 * One schema is shared by the Astro content collection and by the build
 * scripts and tests that read the same files from disk, so a page that Astro
 * accepts and a page the navigation lists can never disagree.
 */

import { z } from "astro/zod";

import { SECTION_IDS } from "./sections.js";

/** The frontmatter every documentation page declares. */
export const docsSchema = z
  .object({
    description: z.string().min(1).max(180),
    order: z.number().int().positive(),
    section: z.enum(SECTION_IDS),
    status: z.literal("ahead").optional(),
    title: z.string().min(1),
  })
  .strict();

/** The validated frontmatter of one documentation page. */
export type DocsFrontmatter = z.infer<typeof docsSchema>;

function unquote(value: string, at: string): string {
  if (!value.startsWith('"')) return value;
  if (!value.endsWith('"') || value.length < 2) {
    throw new Error(`${at}: unterminated quoted value`);
  }
  return value.slice(1, -1).replace(/\\"/g, '"');
}

/**
 * Read the frontmatter block of an MDX file. The block is the restricted
 * `key: value` form the documentation uses; anything richer is rejected so a
 * page cannot mean one thing to Astro and another to the navigation.
 */
export function readFrontmatter(
  source: string,
  at: string,
): { readonly body: string; readonly data: DocsFrontmatter } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) throw new Error(`${at}: missing frontmatter block`);
  const fields: Record<string, string | number> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const field = /^([a-z][A-Za-z]*): (.+)$/.exec(line);
    if (!field) throw new Error(`${at}: unsupported frontmatter line ${line}`);
    const [, key = "", raw = ""] = field;
    if (key in fields) throw new Error(`${at}: duplicate field ${key}`);
    fields[key] = /^-?\d+$/.test(raw) ? Number(raw) : unquote(raw.trim(), at);
  }
  const parsed = docsSchema.safeParse(fields);
  if (!parsed.success) {
    throw new Error(
      `${at}: ${parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".") || "frontmatter"} ${issue.message}`,
        )
        .join("; ")}`,
    );
  }
  return { body: source.slice(match[0].length), data: parsed.data };
}
