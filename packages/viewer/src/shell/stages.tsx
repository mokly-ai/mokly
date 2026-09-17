// Route stage renderers for the served Mokly shell: the framed screen
// stage, ordered use-case flow, whole-document embed, and quiet empty stage shared
// by home and missing routes. All embedded consumer documents are sandboxed
// without script permission.

import type { ReactNode } from "react";

import type { Viewport } from "../data/axes.js";
import { encodeUrlPath } from "../data/paths.js";
import { catalogueViewHref } from "../navigation/delivery.js";
import type { ManifestScreen, ManifestUseCase } from "../registry/types.js";
import { PublicStage } from "../viewer/public_stage.js";
import { routedEntries } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import { ComponentStage } from "./component_stage.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import type { RouteTarget } from "./target.js";

/** Served URLs a frame swaps between; both absent in a light-only catalogue. */
interface FragmentSources {
  dark: string | undefined;
  light: string | undefined;
}

/**
 * The served URL of one generated route. Every embedded frame — its `src` and
 * the scheme attributes the Browse client assigns back into that `src` — is
 * built here so the two can never drift apart.
 */
function fragmentSrc(route: string, fragment?: string): string {
  const source = `/static/${encodeUrlPath(route)}`;
  return fragment ? `${source}#${encodeURIComponent(fragment)}` : source;
}

function fragmentSources(
  screen: ManifestScreen,
  viewport: Viewport,
  hasDarkFragments: boolean,
  fragment?: string,
): FragmentSources {
  if (!hasDarkFragments) {
    return { dark: undefined, light: undefined };
  }
  const dark = screen.darkFragments?.[viewport];
  return {
    dark: dark === undefined ? undefined : fragmentSrc(dark, fragment),
    light: fragmentSrc(screen.fragments[viewport], fragment),
  };
}

/** Whether the screen keeps its light render under a dark selection. */
function isSchemeFallback(
  screen: ManifestScreen,
  hasDarkFragments: boolean,
): boolean {
  return hasDarkFragments && screen.darkFragments === undefined;
}

function FrameLabel(props: { fallback: boolean; text: string }) {
  return (
    <p className="mbk-frame-label">
      {props.text}
      {props.fallback ? (
        <span className="mbk-frame-scheme-note">{" — Light only"}</span>
      ) : null}
    </p>
  );
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

function FramesStage(props: {
  fragment?: string;
  hasDarkFragments: boolean;
  screen: ManifestScreen;
}) {
  const screen = props.screen;
  const address = screen.address ?? screen.route;
  const mobile = fragmentSources(
    screen,
    "mobile",
    props.hasDarkFragments,
    props.fragment,
  );
  const desktop = fragmentSources(
    screen,
    "desktop",
    props.hasDarkFragments,
    props.fragment,
  );
  const fallback = isSchemeFallback(screen, props.hasDarkFragments);
  return (
    <div
      className="mbk-stage mbk-live"
      data-mokly-scroll="stage"
      data-mokly-stage=""
      data-viewport="both"
    >
      <div
        className="mbk-frame-wrap mbk-frame-mobile"
        data-color-scheme-fallback={fallback ? "" : undefined}
      >
        <FrameLabel fallback={fallback} text="Mobile" />
        <PhoneFrame>
          <iframe
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-workspace-frame="mobile"
            data-fragment-dark={mobile.dark}
            data-fragment-light={mobile.light}
            sandbox="allow-same-origin"
            src={fragmentSrc(screen.fragments.mobile, props.fragment)}
            title={`${screen.title} — mobile`}
          />
        </PhoneFrame>
      </div>
      <div
        className="mbk-frame-wrap mbk-frame-desktop"
        data-color-scheme-fallback={fallback ? "" : undefined}
      >
        <FrameLabel fallback={fallback} text="Desktop" />
        <BrowserFrame address={address}>
          <iframe
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-workspace-frame="desktop"
            data-fragment-dark={desktop.dark}
            data-fragment-light={desktop.light}
            sandbox="allow-same-origin"
            src={fragmentSrc(screen.fragments.desktop, props.fragment)}
            title={`${screen.title} — desktop`}
          />
        </BrowserFrame>
      </div>
    </div>
  );
}

function FlowScreen(props: {
  fragment?: string;
  fragmentFrame: boolean;
  hasDarkFragments: boolean;
  screen: ManifestScreen;
}) {
  const screen = props.screen;
  const desktop = fragmentSources(
    screen,
    "desktop",
    props.hasDarkFragments,
    props.fragment,
  );
  const fallback = isSchemeFallback(screen, props.hasDarkFragments);
  return (
    <div
      className="mbk-flow-screen"
      data-color-scheme-fallback={fallback ? "" : undefined}
    >
      <BrowserFrame address={screen.address ?? screen.route}>
        <iframe
          className="mbk-frag"
          data-mokly-fragment-frame={props.fragmentFrame ? "" : undefined}
          data-fragment-dark={desktop.dark}
          data-fragment-light={desktop.light}
          sandbox="allow-same-origin"
          src={fragmentSrc(screen.fragments.desktop, props.fragment)}
          title={`${screen.title} — desktop`}
        />
      </BrowserFrame>
    </div>
  );
}

function UseCaseFlowStage(props: {
  catalogue: Catalogue;
  entry: ManifestUseCase;
  fragment?: string;
}) {
  return (
    <div className="mbk-flow" data-mokly-scroll="flow">
      <div className="flow-track">
        {props.entry.steps.map((step, index) => {
          const candidate = props.catalogue.byId.get(step.screenId);
          const screen = candidate?.kind === "screen" ? candidate : undefined;
          return (
            <section className="flow-step" key={`${step.screenId}-${index}`}>
              <div className="flow-step-head">
                <span className="flow-step-num">{index + 1}</span>
                <div>
                  <h3>{step.title ?? screen?.title ?? step.screenId}</h3>
                  <p>{step.description ?? screen?.description}</p>
                  {screen ? (
                    <a
                      className="flow-step-link"
                      href={catalogueViewHref(screen.route)}
                    >
                      This screen in the catalogue: {screen.title} →
                    </a>
                  ) : null}
                </div>
              </div>
              {screen ? (
                <FlowScreen
                  {...(index === 0 && props.fragment
                    ? { fragment: props.fragment }
                    : {})}
                  fragmentFrame={index === 0}
                  hasDarkFragments={props.catalogue.hasDarkFragments}
                  screen={screen}
                />
              ) : null}
            </section>
          );
        })}
      </div>
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
  target: RouteTarget;
}) {
  const entry = props.target.entry;
  const model = props.catalogue.publicModel;
  if (model) {
    const current = routedEntries(model).find((item) => item.id === entry.id)!;
    return (
      <PublicStage
        catalogue={model}
        entry={current}
        fragment={props.fragment}
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
  if (entry.kind === "component")
    return <ComponentStage variant={entry.variants[0]!} title={entry.title} />;
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
