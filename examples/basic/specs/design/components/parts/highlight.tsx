import { useId, type ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";

export type InspectionSelection = "off" | "outer" | "nested";

/**
 * The highlight of one depicted instance: an outline around it, its label
 * chip, and the dim of the rest of the preview, which the Highlight components
 * switch reveals. No artboard depicts the instance selected, so the region is
 * a picture that opens nothing.
 */
export function SingleHighlight({
  children,
  label,
}: {
  /** The depicted instance. */
  children: ReactNode;
  /** The component and the instance, as the label chip names them. */
  label: string;
}) {
  return (
    <div className="ce-single-action">
      {children}
      <span className="ce-single-highlight ce-highlight-layer">
        <span>{label}</span>
      </span>
    </div>
  );
}

/** Fixed geometry belongs to this synthetic artboard, not the runtime inspector. */
export function HighlightMask({
  selection,
}: {
  selection: Exclude<InspectionSelection, "off">;
}) {
  const nested = selection === "nested";
  const maskId = useId();
  const current = useCurrentPage();
  return (
    <div className="ce-highlight-layer" data-selection={selection}>
      <svg className="ce-mask" aria-hidden="true" width="100%" height="100%">
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <rect width="100%" height="100%" fill="white" />
            {nested ? (
              <rect
                className="ce-nested-cutout"
                x="0"
                y="99"
                width="104"
                height="36"
                rx="8"
                fill="black"
              />
            ) : (
              <>
                <rect
                  className="ce-toolbar-cutout"
                  x="24"
                  y="76"
                  width="100%"
                  height="82"
                  rx="10"
                  fill="black"
                />
                <rect
                  x="24"
                  y="258"
                  width="116"
                  height="36"
                  rx="8"
                  fill="black"
                />
              </>
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="var(--ce-mask, #f4f4f1)"
          fillOpacity="0.78"
          mask={"url(#" + maskId + ")"}
        />
      </svg>
      {nested ? (
        <MockLink
          className="ce-region ce-region--nested"
          to="design/components/inspection/inspection-nested"
          aria-current={current(
            "design/components/inspection/inspection-nested",
          )}
          aria-label="Inspect Action, Toolbar action"
        >
          <span>Action · Toolbar</span>
        </MockLink>
      ) : (
        <>
          <MockLink
            className="ce-region ce-region--toolbar"
            to="design/components/inspection/inspection-nested"
            aria-current={current(
              "design/components/inspection/inspection-nested",
            )}
            aria-label="Inspect Toolbar, Main"
          >
            <span>Toolbar · Main</span>
          </MockLink>
          <MockLink
            className="ce-region ce-region--footer"
            to="design/components/inspection/inspection-details"
            aria-current={current(
              "design/components/inspection/inspection-details",
            )}
            aria-label="Inspect Action, Footer action"
          >
            <span>Action · Footer</span>
          </MockLink>
        </>
      )}
    </div>
  );
}
