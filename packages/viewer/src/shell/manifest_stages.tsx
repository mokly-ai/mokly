/** Screen and use-case stages rendered from the manifest-backed catalogue. */

import {
  currentDocumentPath,
  type GeneratedPathPrefix,
} from "../catalogue/delivery_paths.js";
import type { Viewport } from "../data/axes.js";
import { catalogueViewHref } from "../navigation/delivery.js";
import type { ManifestScreen, ManifestUseCase } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import { framePath } from "./stage_sources.js";

interface FragmentSources {
  dark: string | undefined;
  light: string | undefined;
}

function fragmentSrc(
  route: string,
  fragment?: string,
  prefix?: GeneratedPathPrefix,
): string {
  return framePath(currentDocumentPath(route, prefix), fragment);
}

function fragmentSources(
  screen: ManifestScreen,
  viewport: Viewport,
  hasDarkFragments: boolean,
  fragment?: string,
  prefix?: GeneratedPathPrefix,
): FragmentSources {
  if (!hasDarkFragments) {
    return { dark: undefined, light: undefined };
  }
  const dark = screen.darkFragments?.[viewport];
  return {
    dark: dark === undefined ? undefined : fragmentSrc(dark, fragment, prefix),
    light: fragmentSrc(screen.fragments[viewport], fragment, prefix),
  };
}

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

export function FramesStage(props: {
  prefix?: GeneratedPathPrefix;
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
    props.prefix,
  );
  const desktop = fragmentSources(
    screen,
    "desktop",
    props.hasDarkFragments,
    props.fragment,
    props.prefix,
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
            src={fragmentSrc(
              screen.fragments.mobile,
              props.fragment,
              props.prefix,
            )}
            title={`${screen.title} — mobile`}
          />
        </PhoneFrame>
      </div>
      <div
        className="mbk-frame-wrap mbk-frame-desktop"
        data-color-scheme-fallback={fallback ? "" : undefined}
      >
        <FrameLabel fallback={fallback} text="Desktop" />
        <BrowserFrame address={address} frameKey={`${screen.id}:desktop`}>
          <iframe
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-workspace-frame="desktop"
            data-fragment-dark={desktop.dark}
            data-fragment-light={desktop.light}
            sandbox="allow-same-origin"
            src={fragmentSrc(
              screen.fragments.desktop,
              props.fragment,
              props.prefix,
            )}
            title={`${screen.title} — desktop`}
          />
        </BrowserFrame>
      </div>
    </div>
  );
}

function FlowScreen(props: {
  prefix?: GeneratedPathPrefix;
  fragment?: string;
  stepIndex: number;
  hasDarkFragments: boolean;
  screen: ManifestScreen;
}) {
  const screen = props.screen;
  const desktop = fragmentSources(
    screen,
    "desktop",
    props.hasDarkFragments,
    props.fragment,
    props.prefix,
  );
  const fallback = isSchemeFallback(screen, props.hasDarkFragments);
  return (
    <div
      className="mbk-flow-screen"
      data-color-scheme-fallback={fallback ? "" : undefined}
    >
      <BrowserFrame
        address={screen.address ?? screen.route}
        frameKey={`${screen.id}:flow:${props.stepIndex}`}
      >
        <iframe
          className="mbk-frag"
          data-mokly-fragment-frame={props.stepIndex === 0 ? "" : undefined}
          data-fragment-dark={desktop.dark}
          data-fragment-light={desktop.light}
          sandbox="allow-same-origin"
          src={fragmentSrc(
            screen.fragments.desktop,
            props.fragment,
            props.prefix,
          )}
          title={`${screen.title} — desktop`}
        />
      </BrowserFrame>
    </div>
  );
}

export function UseCaseFlowStage(props: {
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
                  {...(props.catalogue.manifest.schemaVersion === 6 ||
                  props.catalogue.manifest.schemaVersion === "live-index-1"
                    ? { prefix: ".generated" as const }
                    : {})}
                  {...(index === 0 && props.fragment
                    ? { fragment: props.fragment }
                    : {})}
                  hasDarkFragments={props.catalogue.hasDarkFragments}
                  screen={screen}
                  stepIndex={index}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
