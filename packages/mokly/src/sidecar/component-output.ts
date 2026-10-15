import type { ReactNode } from "react";

import type { AuthoringRuntime, RenderSession } from "../authoring/runtime.js";

/** The core uses this private placement to attach the root without owning providers. */
export function componentOutput(
  runtime: AuthoringRuntime,
  session: RenderSession,
  node: ReactNode,
): ReactNode {
  function Output() {
    session.componentOutput = true;
    const id = session.nextRegion();
    return runtime.react.createElement(
      runtime.react.Fragment,
      null,
      session.boundary(`mokly-output:start id="${id}"`),
      node,
      session.boundary(`mokly-output:end id="${id}"`),
    );
  }
  return runtime.react.createElement(Output);
}
