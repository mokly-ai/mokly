// Route stage renderers for the served Mokly shell: the framed screen
// stage, ordered use-case flow, whole-document embed, and quiet empty stage shared
// by home and missing routes. All embedded consumer documents are sandboxed
// without script permission.

import type { ReactNode } from "react";

import {
  GENERATED_DIRECTORY,
  currentDocumentPath,
  type GeneratedPathPrefix,
} from "../catalogue/delivery_paths.js";
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { GeneratedComponentView } from "../components/views.js";
import { entryRoute } from "../navigation/routes.js";
import { routedEntries } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import { ComponentStage } from "./component_stage.js";
import { FramesStage, UseCaseFlowStage } from "./manifest_stages.js";
import { PublicStage } from "./public_stage.js";
import { framePath } from "./stage_sources.js";
import type { RouteTarget } from "./target.js";

function fragmentSrc(
  route: string,
  fragment?: string,
  prefix?: GeneratedPathPrefix,
): string {
  return framePath(currentDocumentPath(route, prefix), fragment);
}

function EmbedStage(props: {
  prefix?: GeneratedPathPrefix;
  route: string;
  title: string;
  fragment?: string;
}) {
  return (
    <div className="mbk-stage-embed" data-mokly-scroll="embed">
      <iframe
        className="mbk-frag"
        sandbox="allow-same-origin"
        data-mokly-fragment-frame=""
        src={fragmentSrc(props.route, props.fragment, props.prefix)}
        title={props.title}
      />
    </div>
  );
}

/** Quiet state used by home, missing routes, and the review launcher. */
export function EmptyStage(props: { children: ReactNode; heading: string }) {
  return (
    <div className="mbk-empty">
      <h2>{props.heading}</h2>
      {props.children}
    </div>
  );
}

/** Render the route-specific preview below the shell-owned heading. */
export function TargetStage(props: {
  catalogue: Catalogue;
  fragment?: string;
  previewViews?: readonly GeneratedComponentView[];
  target: RouteTarget;
  variantId?: string | undefined;
}) {
  const entry = props.target.entry;
  const prefix =
    props.catalogue.manifest.schemaVersion === 8 ||
    props.catalogue.manifest.schemaVersion === "live-index-1"
      ? GENERATED_DIRECTORY
      : undefined;
  const model = props.catalogue.publicModel;
  if (model) {
    const current = routedEntries(model).find((item) => item.id === entry.id)!;
    return (
      <PublicStage
        catalogue={model}
        entry={current}
        hasDarkFragments={props.catalogue.hasDarkFragments}
        {...(props.fragment ? { fragment: props.fragment } : {})}
        {...(props.previewViews ? { previewViews: props.previewViews } : {})}
        {...(props.variantId ? { variantId: props.variantId } : {})}
      />
    );
  }
  if (entry.kind === "page")
    return (
      <EmbedStage
        route={entryRoute("page", entry.id)}
        title={entry.title}
        {...(props.fragment ? { fragment: props.fragment } : {})}
      />
    );
  if (entry.kind === "component") {
    const parent = isManifestComponentVariant(entry)
      ? props.catalogue.byId.get(entry.variantOf)
      : entry;
    if (parent?.kind !== "component" || isManifestComponentVariant(parent))
      return <EmptyStage heading="Component unavailable">{null}</EmptyStage>;
    const variants = (
      props.catalogue.hierarchy.variantsById.get(parent.id) ?? []
    ).filter(
      (candidate): candidate is ManifestComponentVariant =>
        candidate.kind === "component" && isManifestComponentVariant(candidate),
    );
    const variant =
      variants.find((item) => item.id === props.variantId) ?? variants[0]!;
    return (
      <ComponentStage
        title={parent.title}
        variant={variant}
        {...(props.previewViews ? { previewViews: props.previewViews } : {})}
      />
    );
  }
  return entry.kind === "screen" ? (
    <FramesStage
      {...(prefix ? { prefix } : {})}
      {...(props.fragment ? { fragment: props.fragment } : {})}
      hasDarkFragments={props.catalogue.hasDarkFragments}
      screen={entry}
    />
  ) : (
    <UseCaseFlowStage
      catalogue={props.catalogue}
      entry={entry}
      {...(props.fragment ? { fragment: props.fragment } : {})}
    />
  );
}
