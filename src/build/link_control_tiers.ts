/** Placement tiers and element descriptions for styled link controls. */

import type { DefaultTreeAdapterMap } from "parse5";

import { escapeTerminalControlCharacters } from "../diagnostics/terminal_text.js";

type ControlElement = DefaultTreeAdapterMap["element"];
type ClassifiedAttribute = "contenteditable" | "controls" | "role" | "tabindex";

type PlacementFeature =
  | { readonly kind: "element" }
  | {
      readonly kind: "attribute";
      readonly name: ClassifiedAttribute;
      readonly value: string;
    }
  | { readonly kind: "event"; readonly name: string };

interface PlacementMatchBase {
  readonly element: ControlElement;
  readonly feature: PlacementFeature;
}

/** Highest non-silent tier and first feature at that tier for one element. */
export type LinkControlPlacement =
  | (PlacementMatchBase & { readonly tier: "error" })
  | (PlacementMatchBase & { readonly tier: "warning" });

/** A placement result narrowed to the non-fatal tier. */
export type LinkControlWarning = Extract<
  LinkControlPlacement,
  { readonly tier: "warning" }
>;

const ANCESTOR_ERROR_TAGS = new Set(["a", "area"]);
const ANCESTOR_WARNING_TAGS = new Set(["button", "label", "summary", "object"]);
const DESCENDANT_ERROR_TAGS = new Set([
  "a",
  "area",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "details",
  "label",
  "iframe",
  "object",
  "embed",
]);
const WARNING_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "combobox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);
const GROUP_ROLES = new Set([
  "gridcell",
  "listbox",
  "menu",
  "menubar",
  "radiogroup",
  "tablist",
  "tree",
  "treegrid",
]);

/** Classify one ancestor independently of its distance from the control. */
export function classifyLinkControlAncestor(
  element: ControlElement,
): LinkControlPlacement | undefined {
  return strongestPlacement(element, [
    tagPlacement(element, ANCESTOR_ERROR_TAGS, ANCESTOR_WARNING_TAGS),
    editablePlacement(element),
    controlsPlacement(element, "warning"),
    rolePlacement(element, "ancestor"),
  ]);
}

/** Classify one descendant independently of its document position. */
export function classifyLinkControlDescendant(
  element: ControlElement,
): LinkControlPlacement | undefined {
  const event = element.attrs.find((candidate) =>
    candidate.name.startsWith("on"),
  );
  const tabindex = attributeValue(element, "tabindex");
  return strongestPlacement(element, [
    tagPlacement(element, DESCENDANT_ERROR_TAGS),
    editablePlacement(element),
    controlsPlacement(element, "error"),
    rolePlacement(element, "descendant"),
    event
      ? { tier: "error", feature: { kind: "event", name: event.name } }
      : undefined,
    tabindex === undefined
      ? undefined
      : {
          tier: "warning",
          feature: {
            kind: "attribute",
            name: "tabindex",
            value: tabindex,
          },
        },
  ]);
}

/** Render the feature selected by tier and precedence as one safe line. */
export function describeLinkControlElement(
  placement: LinkControlPlacement,
): string {
  const { element, feature } = placement;
  const description =
    feature.kind === "element"
      ? `<${element.tagName}>`
      : feature.kind === "event"
        ? `<${element.tagName} ${feature.name}>`
        : `<${element.tagName} ${feature.name}="${displayValue(feature.value)}">`;
  return escapeTerminalControlCharacters(description);
}

interface Candidate {
  readonly feature: PlacementFeature;
  readonly tier: "error" | "warning";
}

function strongestPlacement(
  element: ControlElement,
  candidates: readonly (Candidate | undefined)[],
): LinkControlPlacement | undefined {
  const selected =
    candidates.find((candidate) => candidate?.tier === "error") ??
    candidates.find((candidate) => candidate?.tier === "warning");
  return selected ? { ...selected, element } : undefined;
}

function tagPlacement(
  element: ControlElement,
  errors: ReadonlySet<string>,
  warnings?: ReadonlySet<string>,
): Candidate | undefined {
  if (errors.has(element.tagName))
    return { tier: "error", feature: { kind: "element" } };
  return warnings?.has(element.tagName)
    ? { tier: "warning", feature: { kind: "element" } }
    : undefined;
}

function editablePlacement(element: ControlElement): Candidate | undefined {
  const value = attributeValue(element, "contenteditable");
  return value === undefined || value === "false"
    ? undefined
    : {
        tier: "error",
        feature: { kind: "attribute", name: "contenteditable", value },
      };
}

function controlsPlacement(
  element: ControlElement,
  tier: Candidate["tier"],
): Candidate | undefined {
  const value = attributeValue(element, "controls");
  return !["audio", "video"].includes(element.tagName) || value === undefined
    ? undefined
    : { tier, feature: { kind: "attribute", name: "controls", value } };
}

function rolePlacement(
  element: ControlElement,
  direction: "ancestor" | "descendant",
): Candidate | undefined {
  const value = attributeValue(element, "role");
  if (value === undefined) return;
  const tokens = value.split(/\s+/u);
  if (tokens.some((role) => WARNING_ROLES.has(role)))
    return {
      tier: direction === "ancestor" ? "warning" : "error",
      feature: { kind: "attribute", name: "role", value },
    };
  return direction === "descendant" &&
    tokens.some((role) => GROUP_ROLES.has(role))
    ? {
        tier: "warning",
        feature: { kind: "attribute", name: "role", value },
      }
    : undefined;
}

function attributeValue(
  element: ControlElement,
  name: string,
): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

function displayValue(value: string): string {
  return value.replace(/\s+/gu, " ").trim().replaceAll('"', "&quot;");
}
