import {
  Fragment,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { isCatalogueId, isLogicalFragment } from "@mokly/viewer/data";

/** Create an id-addressed link resolved during static generation. */
export function mockLink(id: string, fragment?: string): string {
  if (!isCatalogueId(id)) {
    throw new TypeError("mockLink expected kebab-case catalogue id");
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
  to: string;
}

interface ChildLinkProps {
  asChild: true;
  children: ReactElement;
  fragment?: string;
  to: string;
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
