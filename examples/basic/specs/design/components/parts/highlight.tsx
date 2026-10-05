import { useId } from "react";

import { MockLink } from "@mokly/mokly";

export type InspectionSelection = "off" | "outer" | "nested";

/** Fixed geometry belongs to this synthetic artboard, not the runtime inspector. */
export function HighlightMask({
  selection,
}: {
  selection: Exclude<InspectionSelection, "off">;
}) {
  const nested = selection === "nested";
  const maskId = useId();
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
          aria-label="Inspect Action, Toolbar action"
        >
          <span>Action · Toolbar</span>
        </MockLink>
      ) : (
        <>
          <MockLink
            className="ce-region ce-region--toolbar"
            to="design/components/inspection/inspection-nested"
            aria-label="Inspect Toolbar, Main"
          >
            <span>Toolbar · Main</span>
          </MockLink>
          <MockLink
            className="ce-region ce-region--footer"
            to="design/components/inspection/inspection-details"
            aria-label="Inspect Action, Footer action"
          >
            <span>Action · Footer</span>
          </MockLink>
        </>
      )}
    </div>
  );
}
