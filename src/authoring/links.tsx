import {
  cloneElement,
  Fragment,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { isCatalogueId, isLogicalFragment } from "@mokly/viewer/data";

import {
  activateInteractiveLink,
  interactiveRoutesConfigured,
  resolveInteractiveLink,
} from "../interactive/runtime/route_context.js";

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

interface InteractiveChildProps {
  onClick?: (event: ReactMouseEvent<Element>) => void;
  target?: string;
}

/** Render an anchor, or mark a styled control for static link adaptation. */
export function MockLink({ asChild, fragment, to, ...props }: MockLinkProps) {
  const href = mockLink(to, fragment);
  if (asChild !== undefined && typeof asChild !== "boolean") {
    throw new TypeError("MockLink asChild must be a boolean");
  }
  if (!asChild) {
    const anchorProps = props as Omit<
      AnchorLinkProps,
      "asChild" | "fragment" | "to"
    >;
    if (!interactiveRoutesConfigured())
      return <a {...anchorProps} href={href} />;
    const resolved = resolveInteractiveLink(href, anchorProps.target);
    if (!resolved) return <a {...anchorProps} />;
    const { onClick, ...attributes } = anchorProps;
    return (
      <a
        {...attributes}
        href={resolved.href}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented)
            activateInteractiveLink(event, resolved.identity);
        }}
      />
    );
  }
  if (Object.keys(props).some((key) => key !== "children")) {
    throw new TypeError("MockLink asChild attributes belong on the child");
  }
  if (!isValidElement(props.children) || props.children.type === Fragment) {
    throw new TypeError(
      "MockLink asChild requires one non-Fragment React element",
    );
  }
  if (interactiveRoutesConfigured()) {
    const child = props.children as ReactElement<InteractiveChildProps>;
    const resolved = resolveInteractiveLink(href, child.props.target);
    if (!resolved) return child;
    return cloneElement(child, {
      onClick(event: ReactMouseEvent<Element>) {
        child.props.onClick?.(event);
        if (!event.defaultPrevented)
          activateInteractiveLink(event, resolved.identity);
      },
    });
  }
  return (
    <>
      <template data-mokly-link-child-start={href} />
      {props.children}
      <template data-mokly-link-child-end="" />
    </>
  );
}
