// The route stage renderer of the served Mokly shell: the routed entry's
// stage, which waits for the entry's detail. A screen, a component, a page,
// a Markdown document and a use case stand on the canvas in both layouts.
// All embedded consumer documents are sandboxed without script permission.

import { CanvasReadingStage } from "./canvas_reading.js";
import { CanvasUseCaseStage } from "./canvas_use_case.js";
import {
  CanvasWorkspaceStage,
  type WorkspaceCanvas,
} from "./canvas_workspace.js";
import type { Catalogue } from "./catalogue.js";
import { useRouteDelivery } from "./data_context.js";
import { RetryContent, useRetryFocus } from "./retry_focus.js";
import { routedEntries } from "./selection.js";
import { StageDelivery } from "./stage_delivery.js";
import type { RouteTarget } from "./target.js";

/** Render the route-specific preview of the routed entry. */
export function TargetStage(props: {
  /** A workspace's frames on the canvas. */
  canvas?: WorkspaceCanvas | undefined;
  catalogue: Catalogue;
  fragment?: string;
  target: RouteTarget;
}) {
  const delivery = useRouteDelivery();
  const focus = useRetryFocus();
  const entry = props.target.entry;
  if (delivery && delivery.status !== "ready")
    return (
      <StageDelivery delivery={delivery} focus={focus} kind={entry.kind} />
    );
  const model = props.catalogue.publicModel;
  const current = routedEntries(model).find(
    (item) => item.path === entry.path,
  )!;
  // After a Try again of the stage, its first frame takes focus.
  return (
    <RetryContent value={focus}>
      {current.kind === "use-case" ? (
        // Another use case mounts its own step frames.
        <CanvasUseCaseStage
          catalogue={props.catalogue}
          entry={current}
          fragment={props.fragment}
          key={current.path}
        />
      ) : props.canvas &&
        (current.kind === "screen" || current.kind === "component") ? (
        <CanvasWorkspaceStage
          canvas={props.canvas}
          catalogue={props.catalogue}
          entry={current}
          fragment={props.fragment}
        />
      ) : current.kind === "page" || current.kind === "document" ? (
        <CanvasReadingStage
          catalogue={props.catalogue}
          entry={current}
          fragment={props.fragment}
        />
      ) : null}
    </RetryContent>
  );
}
