import { useId, type CSSProperties } from "react";

import { MockLink } from "@mokly/mokly";

import {
  CloseInspectorIcon,
  InspectorIcon,
} from "../../components/parts/inspector_icons.js";
import { useDesignStyle } from "../style_context.js";

import type { InspectorProps } from "./inspector.js";

export function InspectorView({
  tabs,
  initial,
  sheetSize,
  ...content
}: InspectorProps) {
  useDesignStyle("inspector");
  const group = useId();
  return (
    <section className="ce-inspector" aria-label="Inspector">
      <input
        type="checkbox"
        role="switch"
        className="ce-sheet-expand"
        aria-label="Expanded inspector"
        title="Expand or collapse inspector"
        defaultChecked={sheetSize === "expanded"}
      />
      {tabs.map((tab, index) => (
        <details
          key={tab.id}
          name={`component-inspector-${group}`}
          data-panel={tab.id}
          open={initial === tab.id}
          style={{ "--tab-column": index + 1 } as CSSProperties}
        >
          <summary role="button" aria-label={tab.label} title={tab.label}>
            {tab.destination ? (
              <MockLink
                to={tab.destination}
                className="ce-inspector-link"
                aria-label={tab.label}
              >
                <InspectorIcon tab={tab.id} />
              </MockLink>
            ) : (
              <InspectorIcon tab={tab.id} />
            )}
            <span
              className="ce-inspector-close"
              data-inspector-close=""
              aria-hidden="true"
              title="Close inspector"
            >
              <CloseInspectorIcon />
            </span>
          </summary>
          <section className="ce-inspector-panel" aria-label={tab.label}>
            {content[tab.id]}
          </section>
        </details>
      ))}
    </section>
  );
}
