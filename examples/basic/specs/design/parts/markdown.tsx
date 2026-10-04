import type { ReactNode } from "react";

import { DesignLink } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";
import { DocumentPane, Stage } from "./stage.js";

/**
 * A Markdown document as Mokly renders it. The catalogue owns the template,
 * so a written spec reads in the shell's own typography and palette inside the
 * same bordered pane as a page, with no device or comparison controls. The
 * body element keeps the reading measure, so no style needs a universal
 * selector that would tie every view linking the sheet to its edits. A
 * document without a dark render keeps its light pane under Dark.
 */
export function MarkdownStage({
  children,
  lightOnly,
}: {
  children: ReactNode;
  lightOnly?: boolean | undefined;
}) {
  return (
    <Stage>
      <DocumentPane lightOnly={lightOnly}>
        <div className="mbk-markdown">
          <article className="mbk-markdown-body">{children}</article>
        </div>
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
