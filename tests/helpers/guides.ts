import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

export const GUIDE_SECTIONS = [
  "start",
  "authoring",
  "catalogue",
  "ci",
  "cli",
  "reference",
] as const;

export type GuideSection = (typeof GUIDE_SECTIONS)[number];

export interface GuideFrontmatter {
  description: string;
  order: number;
  section: GuideSection;
  title: string;
}

export interface GuidePage {
  body: string;
  frontmatter: GuideFrontmatter;
  frontmatterSource: string;
  id: string;
  path: string;
  slug: string;
  source: string;
}

export const guidesRoot = path.join(repositoryRoot, "docs", "guides");

function parseGuide(filename: string, section: GuideSection): GuidePage {
  const source = readFileSync(filename, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source);
  if (!match) throw new Error(`${filename} has invalid frontmatter boundaries`);
  const frontmatterSource = match[1] ?? "";
  const lines = frontmatterSource.split("\n");
  const stringField = (index: number, key: string): string => {
    const field = new RegExp(`^${key}: ("(?:[^"\\\\]|\\\\.)*")$`, "u").exec(
      lines[index] ?? "",
    );
    if (!field?.[1]) throw new Error(`${filename} has invalid ${key}`);
    return JSON.parse(field[1]) as string;
  };
  const order = /^order: ([1-9]\d*)$/u.exec(lines[3] ?? "")?.[1];
  if (!order || lines.length !== 4)
    throw new Error(`${filename} has invalid frontmatter fields`);
  const declaredSection = stringField(2, "section");
  if (!GUIDE_SECTIONS.includes(declaredSection as GuideSection))
    throw new Error(`${filename} has unknown section ${declaredSection}`);
  const slug = path.basename(filename, ".md");
  return {
    body: match[2] ?? "",
    frontmatter: {
      description: stringField(1, "description"),
      order: Number(order),
      section: declaredSection as GuideSection,
      title: stringField(0, "title"),
    },
    frontmatterSource,
    id: `${section}/${slug}`,
    path: filename,
    slug,
    source,
  };
}

export function loadGuides(): readonly GuidePage[] {
  return GUIDE_SECTIONS.flatMap((section) => {
    const directory = path.join(guidesRoot, section);
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => parseGuide(path.join(directory, entry.name), section));
  }).sort((left, right) => {
    const section =
      GUIDE_SECTIONS.indexOf(left.frontmatter.section) -
      GUIDE_SECTIONS.indexOf(right.frontmatter.section);
    return (
      section ||
      left.frontmatter.order - right.frontmatter.order ||
      left.slug.localeCompare(right.slug)
    );
  });
}

export const GUIDES = loadGuides();
export const GUIDE_PATHS = GUIDES.map((guide) => `docs/guides/${guide.id}.md`);

export function withoutFencedCode(source: string): string {
  const kept: string[] = [];
  let fence = false;
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      fence = !fence;
      continue;
    }
    if (!fence) kept.push(line);
  }
  return kept.join("\n");
}

/** The body of one level-two section, without its heading line. */
export function guideSection(body: string, heading: string): string {
  const marker = `\n## ${heading}\n`;
  const start = body.indexOf(marker);
  if (start < 0) throw new Error(`missing guide section ${heading}`);
  const rest = body.slice(start + marker.length);
  const end = rest.indexOf("\n## ");
  return end < 0 ? rest : rest.slice(0, end);
}

/** Every table body row in a Markdown fragment, with trimmed cells. */
export function tableRows(markdown: string): string[][] {
  const lines = markdown.split("\n");
  const separator = (line: string | undefined) => /^\|\s*-/u.test(line ?? "");
  return lines
    .filter(
      (line, index) =>
        line.startsWith("|") &&
        !separator(line) &&
        !separator(lines[index + 1]),
    )
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

/** The literal inside a cell that holds exactly one code span. */
export function codeCell(cell: string | undefined): string {
  const value = /^`([^`]+)`$/u.exec(cell ?? "")?.[1];
  if (!value) throw new Error(`expected one code span, found ${cell}`);
  return value;
}
