import type { ReactNode } from "react";

import type { ComponentRangeTarget } from "@mokly/viewer";

import { ComponentContext, type ComponentScope } from "./render_context.js";

/** Authenticate one physical output boundary without adding a DOM element. */
export function Boundary({
  scope,
  target,
  children,
}: {
  scope: ComponentScope;
  target: ComponentRangeTarget;
  children: ReactNode;
}): ReactNode {
  const token = scope.collector.boundary(target);
  return (
    <>
      <template data-mokly-component-start={token} />
      <ComponentContext value={scope}>{children}</ComponentContext>
      <template data-mokly-component-end={token} />
    </>
  );
}
