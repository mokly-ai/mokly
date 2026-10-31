import type { ReactNode } from "react";

import { PreviousVersion } from "../../../../../packages/ui/src/previous-version/previous-version.js";

import type { DesignDestination } from "./destinations.js";
import { Stage } from "./stage.js";
import { EmptyState } from "./stage_content.js";

/** The removed entry whose previous version an artboard depicts. */
export interface PreviousEntry {
  kind: "document" | "page" | "screen";
  /** The path the entry had at the branch point. */
  path: string;
  title: string;
}

/**
 * The shipped previous version of a removed entry: the quiet band that names
 * what the stage holds, and the stage host around the previous views or the
 * state that stands in for them. The host carries the depicted entry as its
 * request. A light-only document names its fallback in the band, which a
 * Dark render shows, as the shell shows it under a Dark shell.
 */
export function PreviousVersionStage({
  children,
  entry,
  lightOnly = false,
  viewport,
}: {
  children: ReactNode;
  entry: PreviousEntry;
  lightOnly?: boolean | undefined;
  viewport: "both" | "desktop" | "mobile";
}) {
  return (
    <PreviousVersion
      descriptor={JSON.stringify({
        path: entry.path,
        kind: entry.kind,
        title: entry.title,
      })}
      lightOnly={lightOnly}
      viewport={viewport}
    >
      {children}
    </PreviousVersion>
  );
}

/**
 * The stage after the previous version could not be retrieved, in the
 * shell's words. Retry repeats the request, so it returns to the loaded
 * preview in this catalogue. The registered empty state draws it on the
 * shipped stage, as the shell's unavailable state does.
 */
export function PreviewUnavailable({ to }: { to: DesignDestination }) {
  return (
    <Stage>
      <EmptyState
        body="The previous version could not be loaded."
        linkLabel="Retry"
        title="Previous version unavailable"
        to={to}
      />
    </Stage>
  );
}
