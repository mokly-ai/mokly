import type { ReactNode } from "react";

import { DesignLink } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";
import { DocumentPane, Stage } from "./stage.js";

/**
 * A Markdown document as Mokly renders it. The catalogue owns the template,
 * so a written spec reads in the shell's own typography and palette inside the
 * same bordered pane as a page, with no device or comparison controls.
 */
export function MarkdownStage({ children }: { children: ReactNode }) {
  return (
    <Stage>
      <DocumentPane>
        <article className="mbk-markdown">{children}</article>
      </DocumentPane>
    </Stage>
  );
}

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
