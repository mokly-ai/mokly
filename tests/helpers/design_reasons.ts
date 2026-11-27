import { withAncestors } from "./design_accessibility.js";
import { attribute, textContent, type HtmlElement } from "./html.js";
import { REASON_SENTENCES, type SentenceReason } from "./reason_sentences.js";
import type { ServedCatalogue, ServedView } from "./served_design.js";

// Every Canvas design that shows comparison details reads one sentence per
// direct reason, as the viewer's Details do, under the component workspace
// design contract. A stylesheet reason reads only through the changed files,
// so a design whose only reason is a stylesheet shows no reason sentence,
// and neither does an unchanged entry or a page. A use case's `screen`
// reason reads only through its changed steps. Every Canvas design whose
// Changes tab is open, or that draws comparison details, must be in the
// list, so a new design of a change cannot leave out its reasons. An
// unchanged entry without evidence draws no comparison details. A removed
// entry's Changes tab keeps its reason beside its previous version, also
// while that version loads or failed.

type Viewport = "desktop" | "mobile";

/** A design, its depicted direct reasons, and the artboards that show them. */
type ReasonRow = readonly [
  route: string,
  reasons: readonly SentenceReason[],
  viewports: readonly Viewport[],
];

/** Both artboards draw the comparison details. */
const BOTH = ["desktop", "mobile"] as const;
/** A phone shows the frames of a comparison with the panel sheet closed. */
const DESKTOP = ["desktop"] as const;

/** Each Canvas design's depicted direct reasons that have a sentence. */
const REASONS: readonly ReasonRow[] = [
  ["design/canvas/changes/current", ["material"], BOTH],
  ["design/canvas/changes/side-by-side", ["material"], DESKTOP],
  ["design/canvas/changes/overlay", ["material"], DESKTOP],
  ["design/canvas/changes/difference", ["material"], DESKTOP],
  ["design/canvas/changes/swipe", ["material"], DESKTOP],
  ["design/canvas/components/affected", [], DESKTOP],
  ["design/canvas/components/affected/details", [], DESKTOP],
  ["design/canvas/components/affected/direct", ["inputs", "material"], BOTH],
  ["design/canvas/components/compare", ["material"], DESKTOP],
  ["design/canvas/components/compare/current", ["material"], BOTH],
  ["design/canvas/components/compare/difference", ["material"], DESKTOP],
  ["design/canvas/components/compare/side-by-side", ["material"], DESKTOP],
  ["design/canvas/components/removed/changes", ["removed"], DESKTOP],
  ["design/canvas/components/removed/consumer-changes", ["removed"], BOTH],
  ["design/canvas/evidence/ignored", [], BOTH],
  ["design/canvas/evidence/page", [], BOTH],
  ["design/canvas/evidence/styles", [], BOTH],
  ["design/canvas/evidence/styles/excluded", [], BOTH],
  ["design/canvas/evidence/styles/unnamed", [], BOTH],
  ["design/canvas/evidence/styles/unresolved", [], BOTH],
  ["design/canvas/evidence/unchanged", [], BOTH],
  ["design/canvas/evidence/unchanged/action", [], BOTH],
  ["design/canvas/flows/tour/changes", [], BOTH],
  ["design/canvas/outcomes/added/changes", ["added"], BOTH],
  ["design/canvas/outcomes/moved", ["material"], DESKTOP],
  ["design/canvas/outcomes/removed", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed/long", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed/loading", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed/unavailable", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed-document", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed-document/long", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed-document/loading", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed-document/unavailable", ["removed"], DESKTOP],
  ["design/canvas/outcomes/removed-variant", ["removed"], BOTH],
];

/** Unchanged Canvas entries without evidence, which draw no details. */
const NO_EVIDENCE = [
  "design/canvas/inspect/unchanged",
  "design/canvas/props/editing/edited",
  "design/canvas/stage/component-set",
];

/** The moved design names its previous path before its reason. */
const MOVED = "design/canvas/outcomes/moved";
const MOVED_LEAD =
  /^The previous version is at .+, where it was before the move\.$/u;

/** Text as a reader meets it: whitespace runs collapse, the ends trim. */
function words(element: HtmlElement): string {
  return textContent(element).replace(/\s+/gu, " ").trim();
}

function hasClass(element: HtmlElement, name: string): boolean {
  return (attribute(element, "class") ?? "").split(/\s+/u).includes(name);
}

/** Every element of a view with its element ancestors, nearest first. */
function elements(view: ServedView) {
  return [...withAncestors(view.document)];
}

/** The `.mbk-comparison-evidence` elements, and those in `.cv-evidence`. */
function evidence(view: ServedView) {
  const all = elements(view).filter(([element]) =>
    hasClass(element, "mbk-comparison-evidence"),
  );
  return {
    all: all.map(([element]) => element),
    panel: all
      .filter(([, ancestors]) =>
        ancestors.some((ancestor) => hasClass(ancestor, "cv-evidence")),
      )
      .map(([element]) => element),
  };
}

/** The innermost elements below `root` whose text is exactly `sentence`. */
function sentenceCount(root: HtmlElement, sentence: string): number {
  return [...withAncestors(root)].filter(
    ([element]) =>
      words(element) === sentence &&
      !element.childNodes.some(
        (child) => "tagName" in child && words(child) === sentence,
      ),
  ).length;
}

/** The light view of a design in one viewport. */
function lightView(catalogue: ServedCatalogue, path: string, viewport: string) {
  return catalogue.views.find(
    (view) =>
      view.path === path &&
      view.viewport === viewport &&
      view.colorScheme === "light",
  );
}

/** Each listed design view whose comparison details break the rule. */
function listedViolations(catalogue: ServedCatalogue): string[] {
  const violations: string[] = [];
  for (const [path, reasons, viewports] of REASONS)
    for (const viewport of viewports) {
      const label = `${path} ${viewport}`;
      const view = lightView(catalogue, path, viewport);
      if (!view) {
        violations.push(`${label}: no view`);
        continue;
      }
      // The facts appear once, in the comparison details of the panel.
      const { all, panel } = evidence(view);
      if (all.length !== 1 || panel.length !== 1) {
        violations.push(`${label}: ${all.length} details, ${panel.length}`);
        continue;
      }
      const text = words(panel[0]!);
      if (!text.includes("Comparison details"))
        violations.push(`${label}: no "Comparison details"`);
      if (text.includes("corners and spacing"))
        violations.push(`${label}: reads "corners and spacing"`);
      for (const [kind, sentence] of Object.entries(REASON_SENTENCES)) {
        const count = sentenceCount(panel[0]!, sentence);
        const expected = reasons.includes(kind as SentenceReason) ? 1 : 0;
        if (count !== expected)
          violations.push(`${label}: ${kind} ${count} times, not ${expected}`);
      }
    }
  return violations;
}

/** Each unchanged design without evidence that draws comparison details. */
function unchangedViolations(catalogue: ServedCatalogue): string[] {
  return NO_EVIDENCE.flatMap((path) =>
    BOTH.flatMap((viewport) => {
      const label = `${path} ${viewport}`;
      const view = lightView(catalogue, path, viewport);
      if (!view) return [`${label}: no view`];
      const roots = elements(view).filter(([element]) =>
        hasClass(element, "cv-root"),
      ).length;
      const details = evidence(view).all.length;
      return roots === 1 && details === 0
        ? []
        : [`${label}: ${roots} roots, ${details} details`];
    }),
  );
}

/**
 * Each Canvas desktop design that opens Changes or draws comparison details
 * and is not listed. Each mark must occur, so a renamed class cannot narrow
 * the check unseen.
 */
function coverageViolations(catalogue: ServedCatalogue): string[] {
  const listed = new Set(REASONS.map(([path]) => path));
  const seen = new Set<string>();
  const violations: string[] = [];
  for (const view of catalogue.views) {
    if (
      view.kind !== "screen" ||
      !view.path.startsWith("design/canvas/") ||
      view.viewport !== "desktop" ||
      view.colorScheme !== "light"
    )
      continue;
    const changes = elements(view).some(
      ([element]) =>
        hasClass(element, "cv-ptab") &&
        attribute(element, "data-tab") === "changes" &&
        attribute(element, "data-selected") !== undefined,
    );
    const details = evidence(view).panel.length > 0;
    if (changes) seen.add("changes tab");
    if (details) seen.add("comparison details");
    if ((changes || details) && !listed.has(view.path))
      violations.push(`${view.path}: not listed`);
  }
  for (const mark of ["changes tab", "comparison details"])
    if (!seen.has(mark)) violations.push(`no design draws the ${mark}`);
  return violations;
}

/** The moved design's paragraphs: its previous path, then its reason. */
function movedViolations(catalogue: ServedCatalogue): string[] {
  const view = lightView(catalogue, MOVED, "desktop");
  if (!view) return [`${MOVED}: no view`];
  const [panel] = evidence(view).panel;
  const paragraphs = (panel?.childNodes ?? [])
    .filter((child): child is HtmlElement => "tagName" in child)
    .filter((child) => child.tagName === "p")
    .map(words);
  return paragraphs.length === 2 &&
    MOVED_LEAD.test(paragraphs[0]!) &&
    paragraphs[1] === REASON_SENTENCES.material
    ? []
    : [`${MOVED}: ${JSON.stringify(paragraphs)}`];
}

/**
 * Each Canvas design view whose comparison details do not read one sentence
 * for each depicted direct reason, or that draws details it should not.
 */
export function reasonViolations(catalogue: ServedCatalogue): string[] {
  return [
    ...coverageViolations(catalogue),
    ...listedViolations(catalogue),
    ...unchangedViolations(catalogue),
    ...movedViolations(catalogue),
  ];
}
