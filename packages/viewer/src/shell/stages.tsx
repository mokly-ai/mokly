// Route stage renderers for the served Mokly shell: the framed screen
// stage, ordered use-case flow, whole-document embed, and quiet empty stage shared
// by home and missing routes. All embedded consumer documents are sandboxed
// without script permission.

import { useContext, type ReactNode } from "react";

import { currentCatalogueEntries } from "../catalogue/entry_selection.js";
import type { CurrentPath } from "../catalogue/path_types.js";
import type { ManifestComponentVariant } from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import { encodeUrlPath } from "../data/paths.js";
import { documentRoute, entryRoute } from "../navigation/routes.js";
import type { ManifestUseCase } from "../registry/types.js";
import { DisplaySelection } from "../viewer/display_context.js";

import type { Catalogue } from "./catalogue.js";
import { ComponentStage } from "./component_stage.js";
import { FramesStage, UseCaseFlowStage } from "./manifest_stages.js";
import { PublicStage } from "./public_stage.js";
import { documentLightOnly, LightOnlyBand } from "./scheme_fallback.js";
import type { RouteTarget } from "./target.js";
import type { ShellGeneratedView } from "./usage_types.js";

function fragmentSrc(route: string, fragment?: string): string {
  const source = `/static/${encodeUrlPath(route)}`;
  return fragment ? `${source}#${encodeURIComponent(fragment)}` : source;
}

function EmbedStage(props: {
  route: string;
  title: string;
  fragment?: string;
  lightRoute?: string;
  darkRoute?: string;
}) {
  return (
    <div className="mbk-stage-embed" data-mokly-scroll="embed">
      <iframe
        className="mbk-frag"
        sandbox="allow-same-origin"
        data-mokly-fragment-frame=""
        data-fragment-light={
          props.lightRoute
            ? fragmentSrc(props.lightRoute, props.fragment)
            : undefined
        }
        data-fragment-dark={
          props.darkRoute
            ? fragmentSrc(props.darkRoute, props.fragment)
            : undefined
        }
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
  previewViews?: readonly ShellGeneratedView[];
  target: RouteTarget;
  variantPath?: string | undefined;
}) {
  const selection = useContext(DisplaySelection);
  const entry = props.target.entry;
  const model = props.catalogue.publicModel;
  if (model) {
    const current = currentCatalogueEntries(model).find(
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
  if (entry.kind === "page" || entry.kind === "document")
    return (
      <>
        {documentLightOnly(entry, props.catalogue.hasDarkFragments) ? (
          <LightOnlyBand />
        ) : null}
        <EmbedStage
          route={
            entry.kind === "page"
              ? entryRoute(entry.path)
              : documentRoute(
                  entry.path,
                  entry.colorSchemes.includes(selection.colorScheme)
                    ? selection.colorScheme
                    : "light",
                )
          }
          title={entry.title}
          {...(entry.kind === "document"
            ? {
                lightRoute: documentRoute(entry.path, "light"),
                ...(entry.colorSchemes.includes("dark")
                  ? { darkRoute: documentRoute(entry.path, "dark") }
                  : {}),
              }
            : {})}
          {...(props.fragment ? { fragment: props.fragment } : {})}
        />
      </>
    );
  if (entry.kind === "component") {
    const parent = isManifestComponentVariant(entry)
      ? props.catalogue.hierarchy.variantParentByPath.get(entry.path)
      : entry;
    if (parent?.kind !== "component" || isManifestComponentVariant(parent))
      return <EmptyStage heading="Component unavailable">{null}</EmptyStage>;
    const variants = (
      props.catalogue.hierarchy.variantsByPath.get(parent.path) ?? []
    ).filter(
      (candidate): candidate is ManifestComponentVariant<CurrentPath> =>
        candidate.kind === "component" && isManifestComponentVariant(candidate),
    );
    const variant =
      variants.find((item) => item.path === props.variantPath) ?? variants[0]!;
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
      {...(props.fragment ? { fragment: props.fragment } : {})}
      hasDarkFragments={props.catalogue.hasDarkFragments}
      screen={entry}
    />
  ) : (
    <UseCaseFlowStage
      catalogue={props.catalogue}
      entry={props.catalogue.manifest.entries.find(
        (candidate): candidate is ManifestUseCase<CurrentPath> =>
          candidate.path === entry.path && candidate.kind === "use-case",
      )!}
      {...(props.fragment ? { fragment: props.fragment } : {})}
    />
  );
}
