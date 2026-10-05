/** Adapt explicitly marked React controls before catalogue-link resolution. */

import { parseAuthoredLink } from "./authored_links.js";
import type { BuildDiagnostic } from "./build_warnings.js";
import {
  assertNoChildLinkMarkers,
  parseControlMetadata,
} from "./link_control_metadata.js";
import {
  CHILD_MARKER,
  controlError,
  isElement,
  isInactive,
  validateControl,
  type ControlElement,
  type ControlNode,
} from "./link_control_nodes.js";
import {
  applyControlPatches,
  CONTROL_STYLES,
  controlPatches,
  type ControlPatch,
} from "./link_control_patches.js";
import {
  classifyLinkControlAncestor,
  describeLinkControlElement,
  type LinkControlWarning,
} from "./link_control_tiers.js";

interface Boundary {
  ancestors: ControlElement[];
  node: ControlElement;
  target: string;
}

/** Adapted document bytes and any non-fatal placement diagnostics. */
export interface AdaptedLinkControls {
  readonly diagnostics: readonly BuildDiagnostic[];
  readonly html: string;
}

/** Transform only marked controls, leaving documents without markers untouched. */
export function adaptLinkControls(
  html: string,
  route: string,
): AdaptedLinkControls {
  const metadata = parseControlMetadata(html, route);
  if (metadata?.owners.length)
    throw controlError(route, "contains reserved adaptation metadata");
  if (!metadata?.markers.length) return { diagnostics: [], html };
  const { document, duplicateOffsets } = metadata;
  const diagnostics: BuildDiagnostic[] = [];
  const patches: ControlPatch[] = [];
  let open: Boundary | undefined;
  let styled = false;
  const root = ("childNodes" in document ? document.childNodes : []).find(
    (node) => isElement(node) && node.tagName === "html",
  );
  const children =
    root && "childNodes" in root ? root.childNodes.filter(isElement) : [];
  const head = children.find((node) => node.tagName === "head");
  const body = children.find((node) => node.tagName === "body");
  const styleOffset =
    head?.sourceCodeLocation?.endTag?.startOffset ??
    body?.sourceCodeLocation?.startOffset ??
    (root && isElement(root)
      ? root.sourceCodeLocation?.startTag?.endOffset
      : undefined) ??
    0;
  const visit = (
    node: ControlNode,
    ancestors: ControlElement[],
    inTemplate = false,
  ): void => {
    if (!isElement(node)) {
      if ("childNodes" in node)
        node.childNodes.forEach((child) => visit(child, ancestors, inTemplate));
      return;
    }
    const markers = node.attrs.filter((attr) =>
      attr.name.startsWith(CHILD_MARKER),
    );
    if (markers.length) {
      const marker = markers[0];
      const location = node.sourceCodeLocation;
      if (
        inTemplate ||
        node.tagName !== "template" ||
        node.attrs.length !== 1 ||
        !marker ||
        !location?.startTag ||
        !location.endTag ||
        !("content" in node) ||
        node.content.childNodes.length
      ) {
        throw controlError(route, "has malformed or inert template markers");
      }
      if (marker.name === `${CHILD_MARKER}start`) {
        if (open || !parseAuthoredLink(marker.value))
          throw controlError(route, "has nested or invalid start markers");
        open = { ancestors, node, target: marker.value };
      } else if (marker.name === `${CHILD_MARKER}end`) {
        if (
          !open ||
          marker.value !== "" ||
          open.node.parentNode !== node.parentNode
        ) {
          throw controlError(route, "has unmatched or displaced end markers");
        }
        const start = open.node.sourceCodeLocation;
        if (!start || start.endOffset > location.startOffset)
          throw controlError(route, "has displaced start markers");
        const siblings = node.parentNode?.childNodes ?? [];
        const children = siblings
          .slice(siblings.indexOf(open.node) + 1, siblings.indexOf(node))
          .filter(
            (child) =>
              child.nodeName !== "#comment" &&
              !("value" in child && !child.value.trim()),
          );
        const control = children[0];
        if (children.length !== 1 || !control || !isElement(control))
          throw controlError(route, "must render exactly one root element");
        const controlLocation = control.sourceCodeLocation;
        if (
          !controlLocation ||
          controlLocation.startOffset < start.endOffset ||
          controlLocation.endOffset > location.startOffset
        ) {
          throw controlError(route, "has parser-repaired control boundaries");
        }
        if (
          duplicateOffsets.some(
            (offset) =>
              offset >= start.startOffset && offset <= location.endOffset,
          )
        ) {
          throw controlError(route, "contains duplicate attributes");
        }
        const ancestorWarning = validateAncestors(open.ancestors, route);
        const descendantWarning = validateControl(control, open.target, route);
        if (ancestorWarning)
          diagnostics.push({
            code: "link-control-ancestor",
            route,
            message: `MockLink child control is inside ${describeLinkControlElement(ancestorWarning)}; one click or key press has two targets`,
          });
        if (descendantWarning)
          diagnostics.push({
            code: "link-control-descendant",
            route,
            message:
              descendantWarning.feature.kind === "attribute" &&
              descendantWarning.feature.name === "role"
                ? `MockLink child control contains ${describeLinkControlElement(descendantWarning)}; the role does not belong inside a link`
                : `MockLink child control contains ${describeLinkControlElement(descendantWarning)}; the link has an extra focus stop`,
          });
        const inactive =
          isInactive(control, true) ||
          open.ancestors.some((ancestor) => isInactive(ancestor));
        patches.push(
          ...controlPatches(html, control, open.target, inactive, route),
        );
        styled ||= !inactive;
        open = undefined;
      } else {
        throw controlError(route, "has an unknown marker");
      }
      patches.push({
        start: location.startOffset,
        end: location.endOffset,
        text: "",
      });
      return;
    }
    const nextAncestors = [...ancestors, node];
    node.childNodes.forEach((child) => visit(child, nextAncestors, inTemplate));
    if ("content" in node) visit(node.content, nextAncestors, true);
  };
  visit(document, []);
  if (open) throw controlError(route, "has an unmatched start marker");
  if (styled)
    patches.push({
      start: styleOffset,
      end: styleOffset,
      text: CONTROL_STYLES,
    });
  const result = applyControlPatches(html, patches);
  assertNoChildLinkMarkers(result, route);
  return { diagnostics, html: result };
}

function validateAncestors(
  ancestors: readonly ControlElement[],
  route: string,
): LinkControlWarning | undefined {
  let warning: LinkControlWarning | undefined;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const placement = classifyLinkControlAncestor(ancestors[index]!);
    if (placement?.tier === "error")
      throw controlError(
        route,
        `is inside ${describeLinkControlElement(placement)}; move the control outside it`,
      );
    warning ??= placement;
  }
  return warning;
}
