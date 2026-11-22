// The route stage renderer of the served Mokly shell: the routed entry's
// stage, which waits for the entry's detail. At and above the layout
// breakpoint the entry stands on the canvas; below it, on the one-frame
// stage. All embedded consumer documents are sandboxed without script
// permission.

import type { GeneratedComponentView } from "../components/views.js";

import { useCanvasLayout } from "./canvas_layout.js";
import { CanvasReadingStage } from "./canvas_reading.js";
import {
  CanvasWorkspaceStage,
  type WorkspaceCanvas,
} from "./canvas_workspace.js";
import type { Catalogue } from "./catalogue.js";
import { useRouteDelivery } from "./data_context.js";
import { PublicStage } from "./public_stage.js";
import { RetryContent, useRetryFocus } from "./retry_focus.js";
import { routedEntries } from "./selection.js";
import { StageDelivery } from "./stage_delivery.js";
import type { RouteTarget } from "./target.js";

/** Render the route-specific preview below the shell-owned heading. */
export function TargetStage(props: {
  /** A workspace's frames on the canvas, which it gives in the wide layout. */
  canvas?: WorkspaceCanvas | undefined;
  catalogue: Catalogue;
  fragment?: string;
  previewViews?: readonly GeneratedComponentView[];
  target: RouteTarget;
  variantPath?: string | undefined;
}) {
  const delivery = useRouteDelivery();
  const focus = useRetryFocus();
  const wide = useCanvasLayout();
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
      {props.canvas &&
      (current.kind === "screen" || current.kind === "component") ? (
        <CanvasWorkspaceStage
          canvas={props.canvas}
          catalogue={props.catalogue}
          entry={current}
          fragment={props.fragment}
        />
      ) : wide && (current.kind === "page" || current.kind === "document") ? (
        <CanvasReadingStage
          catalogue={props.catalogue}
          entry={current}
          fragment={props.fragment}
        />
      ) : (
        <PublicStage
          catalogue={model}
          entry={current}
          hasDarkFragments={props.catalogue.hasDarkFragments}
          {...(props.fragment ? { fragment: props.fragment } : {})}
          {...(props.previewViews ? { previewViews: props.previewViews } : {})}
          {...(props.variantPath ? { variantPath: props.variantPath } : {})}
        />
      )}
    </RetryContent>
  );
}
