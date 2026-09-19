// Route stage renderers for the served Mokly shell: the framed screen
// stage, ordered use-case flow, whole-document embed, and quiet empty stage shared
// by home and missing routes. All embedded consumer documents are sandboxed
// without script permission.

import type { ReactNode } from "react";

import type { GeneratedComponentView } from "../components/views.js";
import { encodeUrlPath } from "../data/paths.js";
import { routedEntries } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import { ComponentStage } from "./component_stage.js";
import { FramesStage, UseCaseFlowStage } from "./manifest_stages.js";
import { PublicStage } from "./public_stage.js";
import type { RouteTarget } from "./target.js";

function fragmentSrc(route: string, fragment?: string): string {
  const source = `/static/${encodeUrlPath(route)}`;
  return fragment ? `${source}#${encodeURIComponent(fragment)}` : source;
}

function EmbedStage(props: {
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
        src={fragmentSrc(props.route, props.fragment)}
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
        route={entry.route}
        title={entry.title}
        {...(props.fragment ? { fragment: props.fragment } : {})}
      />
    );
  if (entry.kind === "component") {
    const variant =
      entry.variants.find((item) => item.id === props.variantId) ??
      entry.variants[0]!;
    return (
      <ComponentStage
        title={entry.title}
        variant={variant}
        {...(props.previewViews ? { previewViews: props.previewViews } : {})}
      />
    );
  }
  return entry.kind === "screen" ? (
    <FramesStage
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
