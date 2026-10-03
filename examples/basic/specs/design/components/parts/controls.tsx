import { MockLink } from "@mokly/mokly";

import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES } from "./destinations.js";

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
        <MockLink
          to="design/components/pages/variants"
          aria-current={disabled ? "page" : undefined}
        >
          Disabled
        </MockLink>
      ) : null}
      {removed ? (
        <MockLink to="design/components/states/removed" aria-current="page">
          Compact · Removed
        </MockLink>
      ) : null}
    </nav>
  );
}
