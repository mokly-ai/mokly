import { Caption } from "@firna/ui/typography";
import type { ReactNode } from "react";

import { Badge } from "../../../entries/design/badge.mockup";
import { Input } from "../../../entries/design/input.mockup";
import { sample } from "../../../fixtures/product";
import { useMockupRenderContext } from "../../../render-context";
import { Action } from "../page-parts";
import { TextBar } from "../placeholders";

/**
 * Share's link, Copy link beside it, and who can open it. While the panel
 * reads the link, `hold` is the read's name, and the field is the place that
 * names it: the field keeps its label and its own frame, read only, and holds
 * the name where the link would be. The visibility is the project's, so its
 * badge stays; who can open the link is the read's, so that line is a bar;
 * and Copy link, whose label is known, draws itself disabled. On a phone Copy
 * link takes the panel's width under the field.
 */
export function ShareLink(props: { link: string } | { hold: ReactNode }) {
  const waits = "hold" in props;
  const { viewport } = useMockupRenderContext();
  return (
    <>
      <div className="fo-canvas-share-link">
        <Input
          moklyInstance="share-link"
          label="Publication link"
          name="publication-link"
          type="text"
          {...(waits
            ? { waiting: true, hold: props.hold }
            : { value: props.link })}
        />
        <Action
          instance="share-copy"
          label="Copy link"
          tone="primary"
          size="md"
          disabled={waits}
          {...(viewport === "mobile" ? { block: true } : {})}
        />
      </div>
      <div className="review-inline fo-canvas-share-access">
        <Badge
          moklyInstance="share-visibility"
          label={sample.visibility}
          tone="neutral"
        />
        {/* The line's box measures its content, so its bar takes a length;
            the line's type is in pixels, so enlarged text keeps the bar
            inside the narrowest panel. */}
        <Caption color="muted">
          {waits ? (
            <TextBar width="16em" />
          ) : (
            "Project members can open this link."
          )}
        </Caption>
      </div>
    </>
  );
}
