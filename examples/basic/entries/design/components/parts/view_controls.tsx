import { optional, useDesignInstance } from "../../library/composition.js";
import { viewControls } from "../../library/controls/view-controls.js";
import type { ArtboardViewport } from "../../parts/shell.js";

export interface HighlightOption {
  active: boolean;
  unavailable: "empty" | "unavailable" | "comparison" | "removed" | undefined;
}

/** Screen adapters supply recorded inputs to the same native view controls. */
export function ViewControls({
  viewport,
  highlight,
  schemeDisabled,
}: {
  viewport: ArtboardViewport;
  highlight?: HighlightOption;
  /** Set when only one scheme exists, as on a removed screen's previous views. */
  schemeDisabled?: boolean | undefined;
}) {
  const normalizedSchemeDisabled = schemeDisabled || undefined;
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("view-controls")}
      selection={viewport}
      scheme="light"
      destinations={{}}
      {...optional("highlight", highlight?.active)}
      {...optional("schemeDisabled", normalizedSchemeDisabled)}
      {...optional("unavailable", highlight?.unavailable)}
    />
  );
}

export function PreviewScheme() {
  return (
    <>
      <span className="ce-scheme-light">Light</span>
      <span className="ce-scheme-dark">Dark</span>
    </>
  );
}
