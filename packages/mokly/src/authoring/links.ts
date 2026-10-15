import type { AnchorHTMLAttributes, ReactElement, ReactNode } from "react";

import { isLinkPath, isLogicalFragment } from "@mokly/viewer/data";

import { definitionData } from "./runtime.js";
import type { AuthoringRuntime } from "./runtime.js";
import type { EntryReference } from "./types.js";

type Destination = { to: EntryReference; fragment?: string };
export type MockLinkProps = Destination &
  (
    | { asChild: true; children: ReactElement }
    | ({ asChild?: false } & Omit<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        "href"
      >)
  );

export function validateDestination(target: unknown, fragment?: string): void {
  if (typeof target !== "string") {
    if (!definitionData(target))
      throw new Error("link target must be a path or a definition");
  } else if (!isLinkPath(target)) {
    throw new Error(
      "link target must be a complete or relative catalogue path",
    );
  }

  if (fragment !== undefined && !isLogicalFragment(fragment))
    throw new Error("link fragment must be a bare HTML id");
}

export function linkHelpers(runtime: AuthoringRuntime, source?: string) {
  function mockLink(to: EntryReference, fragment?: string): string {
    validateDestination(to, fragment);
    if (typeof to !== "string")
      return runtime.definitionLink(to, fragment, source);
    return `mock:${to}${fragment ? `#${fragment}` : ""}`;
  }
  function MockLink(props: MockLinkProps): ReactNode {
    const { to, fragment, asChild, children, ...attributes } = props;
    if (asChild !== undefined && typeof asChild !== "boolean")
      throw new Error("MockLink.asChild must be boolean");
    validateDestination(to, fragment);
    const destination =
      typeof to === "string"
        ? mockLink(to, fragment)
        : runtime.session().link(to, fragment);
    if (asChild) {
      const React = runtime.react;
      if (
        Object.keys(attributes).length ||
        !React.isValidElement(children) ||
        children.type === React.Fragment
      )
        throw new Error(
          "MockLink asChild accepts one element and only to, fragment, asChild and children",
        );
      const session = runtime.session();
      const id = session.nextRegion();
      return React.createElement(
        React.Fragment,
        null,
        session.boundary(`mokly-link:start id="${id}" to="${destination}"`),
        children,
        session.boundary(`mokly-link:end id="${id}"`),
      );
    }
    return runtime.react.createElement(
      "a",
      { ...attributes, href: destination },
      children,
    );
  }
  return { mockLink, MockLink };
}
