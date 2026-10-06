import {
  Fragment,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { isLinkPath, isLogicalFragment } from "@mokly/viewer/data";

import { definitionReference, isDefinition } from "./identity.js";
import { COMPONENT_REGISTRATION } from "./markers.js";
import type { EntryDefinition } from "./types.js";

/** A logical path or imported definition, including a parent-first export array. */
export type MockLinkTarget =
  | string
  | EntryDefinition
  | readonly EntryDefinition[]
  | {
      readonly [COMPONENT_REGISTRATION]: true;
      readonly entries: readonly EntryDefinition[];
    };

/** Create a path-addressed link resolved during static generation. */
export function mockLink(to: MockLinkTarget, fragment?: string): string {
  let definition: unknown = Array.isArray(to) ? to[0] : to;
  if (
    typeof definition === "object" &&
    definition !== null &&
    COMPONENT_REGISTRATION in definition &&
    definition[COMPONENT_REGISTRATION] === true &&
    "entries" in definition &&
    Array.isArray(definition.entries)
  )
    definition = definition.entries[0];
  const id =
    isDefinition(definition) && definition.kind !== "folder"
      ? definitionReference(definition)
      : to;
  if (
    typeof id !== "string" ||
    (!(isDefinition(definition) && definition.kind !== "folder") &&
      !isLinkPath(id))
  ) {
    throw new TypeError(
      "mockLink expected a complete path, relative path, or entry definition",
    );
  }
  if (fragment !== undefined && !isLogicalFragment(fragment)) {
    throw new TypeError("mockLink fragment must be a bare HTML id");
  }
  return `mock:${id}${fragment ? `#${fragment}` : ""}`;
}

/** Anchor props for an id-addressed Mokly link. */
interface AnchorLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  asChild?: false;
  children?: ReactNode;
  fragment?: string;
  to: MockLinkTarget;
}

interface ChildLinkProps {
  asChild: true;
  children: ReactElement;
  fragment?: string;
  to: MockLinkTarget;
}

/** Ordinary anchor props or an explicitly adapted single child control. */
export type MockLinkProps = AnchorLinkProps | ChildLinkProps;

/** Render an anchor, or mark a styled control for static link adaptation. */
export function MockLink({ asChild, fragment, to, ...props }: MockLinkProps) {
  const href = mockLink(to, fragment);
  if (asChild !== undefined && typeof asChild !== "boolean") {
    throw new TypeError("MockLink asChild must be a boolean");
  }
  if (!asChild) return <a {...props} href={href} />;
  if (Object.keys(props).some((key) => key !== "children")) {
    throw new TypeError("MockLink asChild attributes belong on the child");
  }
  if (!isValidElement(props.children) || props.children.type === Fragment) {
    throw new TypeError(
      "MockLink asChild requires one non-Fragment React element",
    );
  }
  return (
    <>
      <template data-mokly-link-child-start={href} />
      {props.children}
      <template data-mokly-link-child-end="" />
    </>
  );
}
