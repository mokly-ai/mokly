import { MockLink } from "@mokly/mokly";

import type { ComponentPageState } from "./component_details.js";
import { COMPONENT_PAGES } from "./destinations.js";

/** Saved variants are links between canonical mockup states, with one selected. */
export function VariantPicker({ state }: { state: ComponentPageState }) {
  const disabled = state === "disabled";
  const removed = state === "removed";
  const defaultId =
    state === "toolbar"
      ? "design-component-toolbar"
      : state === "hidden"
        ? "design-component-help"
        : state === "unused" || state === "added" || state === "overlay-tall"
          ? COMPONENT_PAGES[state]
          : "design-component-overview";
  return (
    <nav className="ce-variants" aria-label="Saved variants">
      <span>Variant</span>
      <MockLink
        to={!disabled && !removed ? COMPONENT_PAGES[state] : defaultId}
        aria-current={!disabled && !removed ? "page" : undefined}
      >
        Default
      </MockLink>
      {defaultId === "design-component-overview" ? (
        <MockLink
          to="design-component-variants"
          aria-current={disabled ? "page" : undefined}
        >
          Disabled
        </MockLink>
      ) : null}
      {removed ? (
        <MockLink to="design-component-removed" aria-current="page">
          Compact · Removed
        </MockLink>
      ) : null}
    </nav>
  );
}
