import { MockLink } from "@mokly/mokly";

import { welcomeInstances } from "./fixtures.js";
import type { ScreenPageState } from "./screen_preview.js";

export function InstanceTree({ state }: { state: ScreenPageState }) {
  const nested = state === "nested";
  const toolbar = state === "toolbar-selection";
  const help = state === "help-selection";
  const actionCount = welcomeInstances.filter(
    (instance) => instance.component === "Action",
  ).length;
  return (
    <div className="ce-instance-tree" aria-label="Component instances">
      <details open={nested || toolbar}>
        <summary>
          Toolbar <span>1 instance</span>
        </summary>
        <MockLink
          to="design/components/inspection/selection/inspection-toolbar"
          aria-current={toolbar ? "true" : undefined}
        >
          Main
        </MockLink>
        <div className="ce-nested-instance">
          <MockLink
            to="design/components/inspection/inspection-nested"
            aria-current={nested ? "true" : undefined}
          >
            Action · Toolbar action
          </MockLink>
        </div>
      </details>
      <details open>
        <summary>
          Action <span>{actionCount} instances</span>
        </summary>
        <MockLink
          to="design/components/inspection/inspection-nested"
          aria-current={nested ? "true" : undefined}
        >
          Toolbar action <small>Inside Main toolbar</small>
        </MockLink>
        <MockLink
          to="design/components/inspection/inspection-details"
          aria-current={!nested && !toolbar && !help ? "true" : undefined}
        >
          Footer action <small>Welcome</small>
        </MockLink>
      </details>
      <details open={help}>
        <summary>
          Help hint <span>1 instance</span>
        </summary>
        <MockLink
          to="design/components/inspection/selection/inspection-help"
          aria-current={help ? "true" : undefined}
        >
          Help
        </MockLink>
        <p className="ce-muted">No visible region</p>
      </details>
    </div>
  );
}
