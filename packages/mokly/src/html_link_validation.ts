import type { HtmlReferences } from "./html_references.js";

/** A resource URL or navigation link with its fragment-validation policy. */
export interface ResourceReference {
  checkFragment: boolean;
  value: string;
}

/** Shared HTML graph data used by build and static export validation. */
export interface ParsedResource {
  anchors: ReadonlySet<string>;
  references: readonly ResourceReference[];
}

/** Keep navigation anchors distinct from SVG/CSS and other resource fragments. */
export function htmlResource(references: HtmlReferences): ParsedResource {
  const values = [
    ...references.hrefs.map((value) => ({ checkFragment: true, value })),
    ...references.resources.map((value) => ({ checkFragment: false, value })),
  ];
  const seen = new Set<string>();
  return {
    anchors: references.anchors,
    references: values.filter((reference) => {
      const key = `${reference.checkFragment}:${reference.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

/** Validate the decoded fragment against the resolved target document. */
export function fragmentViolation(
  reference: string,
  anchors: ReadonlySet<string>,
): string | undefined {
  const separator = reference.indexOf("#");
  if (separator < 0) return undefined;
  let fragment: string;
  try {
    fragment = decodeURIComponent(reference.slice(separator + 1));
  } catch {
    return `invalid URL encoding: ${reference}`;
  }
  if (fragment === "" || anchors.has(fragment)) return undefined;
  return `${reference.startsWith("#") || reference.startsWith("?") ? "missing anchor" : "missing target anchor"} ${reference}`;
}
