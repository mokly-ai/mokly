import { MockLink } from "@mokly/mokly";

import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES } from "./destinations.js";

/**
 * Stories whose other saved variants changed too, but own no artboard. Their
 * variant stays visible without a link to an unrelated story's page.
 */
const UNLINKED_SIBLINGS: ReadonlySet<ComponentPageState> = new Set([
  "style-changed",
]);

/** Action's Disabled variant, linked where it owns an artboard in the story. */
function DisabledOption({ state }: { state: ComponentPageState }) {
  if (UNLINKED_SIBLINGS.has(state))
    return <span className="ce-variant-option">Disabled</span>;
  return (
    <MockLink
      to="design/components/pages/variants"
      aria-current={state === "disabled" ? "page" : undefined}
    >
      Disabled
    </MockLink>
  );
}

/** Saved variants are links between canonical mockup states, with one selected. */
export function VariantPicker({ state }: { state: ComponentPageState }) {
  const disabled = state === "disabled";
  const removed = state === "removed";
  const defaultId =
    state === "toolbar"
      ? "design/components/pages/toolbar"
      : state === "hidden"
        ? "design/components/pages/help"
        : state === "unused" || state === "added" || state === "overlay-tall"
          ? COMPONENT_PAGES[state]
          : "design/components/overview";
  return (
    <nav className="ce-variants" aria-label="Saved variants">
      <span>Variant</span>
      <MockLink
        to={!disabled && !removed ? COMPONENT_PAGES[state] : defaultId}
        aria-current={!disabled && !removed ? "page" : undefined}
      >
        Default
      </MockLink>
      {defaultId === "design/components/overview" ? (
        <DisabledOption state={state} />
      ) : null}
      {removed ? (
        <MockLink to="design/components/states/removed" aria-current="page">
          Compact · Removed
        </MockLink>
      ) : null}
    </nav>
  );
}
