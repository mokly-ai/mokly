import type { ReactNode } from "react";

import type { AuthoringRuntime } from "./runtime.js";

export interface ReviewIgnoreProps {
  children?: ReactNode;
  id: string;
  materialKey?: string;
}
export interface ReviewIgnoreScopeProps {
  children?: ReactNode;
  enabled: boolean;
}

export function markerHelpers(runtime: AuthoringRuntime) {
  function ReviewIgnoreScope(props: ReviewIgnoreScopeProps): ReactNode {
    if (typeof props.enabled !== "boolean")
      throw new Error("ReviewIgnoreScope.enabled must be boolean");
    return runtime.react.createElement(
      runtime.contexts.ignore.Provider,
      { value: props.enabled },
      props.children,
    );
  }
  function ReviewIgnore(props: ReviewIgnoreProps): ReactNode {
    if (
      typeof props.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(props.id)
    )
      throw new Error("ReviewIgnore.id must be lowercase kebab-case");
    if (
      props.materialKey !== undefined &&
      (typeof props.materialKey !== "string" ||
        !/^[a-f0-9]{64}$/.test(props.materialKey))
    )
      throw new Error("ReviewIgnore.materialKey must be a SHA-256 digest");
    const enabled = runtime.react.useContext(runtime.contexts.ignore);
    if (!enabled) return props.children;
    const session = runtime.session();
    return runtime.react.createElement(
      runtime.react.Fragment,
      null,
      session.boundary(
        `mokly-ignore:start id="${props.id}"${props.materialKey ? ` key="${props.materialKey}"` : ""}`,
      ),
      props.children,
      session.boundary(`mokly-ignore:end id="${props.id}"`),
    );
  }
  return { ReviewIgnoreScope, ReviewIgnore };
}
