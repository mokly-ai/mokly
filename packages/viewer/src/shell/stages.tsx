// The route stage renderer of the served Mokly shell: the routed entry's
// stage, which waits for the entry's detail. All embedded consumer documents
// are sandboxed without script permission.

import type { GeneratedComponentView } from "../components/views.js";

import type { Catalogue } from "./catalogue.js";
import { useRouteDelivery } from "./data_context.js";
import { PublicStage } from "./public_stage.js";
import { routedEntries } from "./selection.js";
import { StageDelivery } from "./stage_delivery.js";
import type { RouteTarget } from "./target.js";

/** Render the route-specific preview below the shell-owned heading. */
export function TargetStage(props: {
  catalogue: Catalogue;
  fragment?: string;
  previewViews?: readonly GeneratedComponentView[];
  target: RouteTarget;
  variantPath?: string | undefined;
}) {
  const delivery = useRouteDelivery();
  const entry = props.target.entry;
  if (delivery && delivery.status !== "ready")
    return <StageDelivery delivery={delivery} kind={entry.kind} />;
  const model = props.catalogue.publicModel;
  const current = routedEntries(model).find(
    (item) => item.path === entry.path,
  )!;
  return (
    <PublicStage
      catalogue={model}
      entry={current}
      hasDarkFragments={props.catalogue.hasDarkFragments}
      {...(props.fragment ? { fragment: props.fragment } : {})}
      {...(props.previewViews ? { previewViews: props.previewViews } : {})}
      {...(props.variantPath ? { variantPath: props.variantPath } : {})}
    />
  );
}
