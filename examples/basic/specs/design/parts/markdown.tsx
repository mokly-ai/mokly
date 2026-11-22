import { DesignLink } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";

/**
 * A link inside a rendered document. It opens the design state that depicts
 * its target; a target with no depicted state stays a styled, inert label.
 */
export function DocumentLink({
  children,
  to,
}: {
  children: string;
  to?: DesignDestination | undefined;
}) {
  return (
    <DesignLink to={to}>
      <span className="mbk-markdown-link">{children}</span>
    </DesignLink>
  );
}
