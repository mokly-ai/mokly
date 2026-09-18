import { useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import type {
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueScreen,
  CatalogueView,
} from "../catalogue/types.js";
import { encodeUrlPath } from "../data/paths.js";
import { BrowserFrame, PhoneFrame } from "../shell/frames.js";

import { DisplaySelection } from "./display_context.js";
import { frameLocation } from "./frame_location.js";

function frameUrl(
  view: CatalogueView | undefined,
  fragment?: string,
  stepIndex?: number,
): string | undefined {
  if (!view?.fragmentPath) return;
  return frameLocation(view.fragmentPath, fragment, stepIndex);
}
function PublicFrame({
  entry,
  views,
  viewport,
  flow = false,
  fragment,
  stepIndex,
}: {
  entry: CatalogueRoutedEntry;
  views: readonly CatalogueView[];
  viewport: "mobile" | "desktop";
  flow?: boolean;
  fragment?: string | undefined;
  stepIndex?: number;
}) {
  const selection = useContext(DisplaySelection);
  const light = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  );
  const dark = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "dark",
  );
  const selected = selection.colorScheme === "dark" ? (dark ?? light) : light;
  const src = frameUrl(selected, fragment, stepIndex);
  const frame = useRef<HTMLIFrameElement>(null);
  const initialSource = useRef(src);
  const appliedSource = useRef(src);
  useEffect(() => {
    if (!src || src === appliedSource.current || !frame.current) return;
    frame.current.contentWindow?.location.replace(
      new URL(src, frame.current.ownerDocument.baseURI).href,
    );
    frame.current.dataset["fragmentCurrent"] = src;
    appliedSource.current = src;
  }, [src]);
  const component = entry.kind === "component";
  const Frame = component
    ? ({ children }: { children: ReactNode }) => <>{children}</>
    : viewport === "mobile"
      ? PhoneFrame
      : BrowserFrame;
  return (
    <div
      className={
        flow
          ? "mbk-flow-screen"
          : `${component ? "mbk-component-canvas" : "mbk-frame-wrap"} mbk-frame-${viewport}`
      }
      data-color-scheme-fallback={!dark ? "" : undefined}
    >
      {!flow && (
        <p className="mbk-frame-label">
          {viewport === "mobile" ? "Mobile" : "Desktop"}
          {!dark && (
            <span className="mbk-frame-scheme-note"> — Light only</span>
          )}
        </p>
      )}
      {src ? (
        <Frame
          address={
            entry.kind === "screen"
              ? (entry.address ?? entry.route)
              : entry.route
          }
          frameKey={`${entry.id}:${stepIndex ?? "single"}:${viewport}`}
        >
          <iframe
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-workspace-frame={flow ? undefined : viewport}
            data-fragment-light={frameUrl(light, fragment, stepIndex)}
            data-fragment-dark={frameUrl(dark, fragment, stepIndex)}
            ref={frame}
            sandbox="allow-same-origin"
            src={initialSource.current}
            title={`${entry.title} — ${viewport}`}
          />
        </Frame>
      ) : (
        <p className="mbk-empty">This preview is unavailable.</p>
      )}
    </div>
  );
}
function Flow({
  entry,
  catalogue,
  fragment,
}: {
  entry: Extract<CatalogueRoutedEntry, { kind: "use-case" }>;
  catalogue: CatalogueReadModel;
  fragment?: string | undefined;
}) {
  return (
    <div className="mbk-flow" data-mokly-scroll="flow">
      <div className="flow-track">
        {entry.steps.map((step, index) => {
          const screen = catalogue.screens.find(
            (screen) => screen.id === step.screenId,
          )!;
          return (
            <section className="flow-step" key={`${step.screenId}-${index}`}>
              <div className="flow-step-head">
                <span className="flow-step-num">{index + 1}</span>
                <div>
                  <h3>{step.title ?? screen.title}</h3>
                  <p>{step.description ?? screen.details.description}</p>
                  <a
                    className="flow-step-link"
                    href={`/view/${encodeUrlPath(screen.route)}`}
                  >
                    This screen in the catalogue: {screen.title} →
                  </a>
                </div>
              </div>
              <PublicFrame
                entry={screen}
                views={screen.views}
                viewport="desktop"
                flow
                fragment={fragment}
                stepIndex={index}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
/** Only validated current paths become requests; absent views render an explicit state. */
export function PublicStage({
  catalogue,
  entry,
  fragment,
  variantId,
}: {
  catalogue: CatalogueReadModel;
  entry: CatalogueRoutedEntry;
  fragment?: string | undefined;
  variantId?: string | undefined;
}) {
  const selection = useContext(DisplaySelection);
  if (entry.kind === "page")
    return (
      <div className="mbk-stage-embed" data-mokly-scroll="embed" key={entry.id}>
        {entry.documentPath ? (
          <iframe
            className="mbk-frag"
            sandbox="allow-same-origin"
            data-mokly-fragment-frame=""
            src={frameLocation(entry.documentPath, fragment)}
            title={entry.title}
          />
        ) : (
          <p className="mbk-empty">This preview is unavailable.</p>
        )}
      </div>
    );
  if (entry.kind === "use-case")
    return (
      <Flow
        key={entry.id}
        entry={entry}
        catalogue={catalogue}
        fragment={fragment}
      />
    );
  const views =
    entry.kind === "component"
      ? (entry.variants.find((variant) => variant.id === variantId) ??
          entry.variants[0])!.views
      : (entry as CatalogueScreen).views;
  return (
    <div
      className={`mbk-stage ${entry.kind === "component" ? "mbk-component-stage" : "mbk-live"}`}
      data-mokly-scroll="stage"
      data-mokly-stage=""
      data-viewport={selection.viewport}
      key={`${entry.id}:${variantId ?? ""}`}
    >
      {entry.viewports.map((viewport) => (
        <PublicFrame
          key={`${entry.id}:${variantId ?? ""}:${viewport}`}
          entry={entry}
          views={views}
          viewport={viewport}
          fragment={fragment}
        />
      ))}
    </div>
  );
}
