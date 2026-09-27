import { useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { catalogueComponentVariants } from "../catalogue/entry_selection.js";
import type {
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
} from "../catalogue/types.js";
import { entryRoute, viewHref } from "../navigation/routes.js";
import { VIEWPORTS } from "../registry/views.js";
import { BrowserFrame, PhoneFrame } from "../shell/frames.js";
import { framePath, frameSource } from "../shell/stage_sources.js";

import { DisplaySelection } from "./display_context.js";

function frameUrl(
  entry: Extract<CatalogueRecord, { kind: "component" | "screen" }>,
  view: CatalogueView | undefined,
  fragment?: string,
  stepIndex?: number,
): string | undefined {
  return frameSource(entry, view, fragment, stepIndex);
}
function PublicFrame({
  entry,
  views,
  viewport,
  flow = false,
  fragment,
  stepIndex,
}: {
  entry: Extract<CatalogueRecord, { kind: "component" | "screen" }>;
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
  const src = frameUrl(entry, selected, fragment, stepIndex);
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
      data-preview-color-scheme={selected?.colorScheme ?? "light"}
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
              ? (entry.address ?? entryRoute(entry.kind, entry.id))
              : entryRoute(entry.kind, entry.id)
          }
          frameKey={`${entry.id}:${stepIndex ?? "single"}:${viewport}`}
        >
          <iframe
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-workspace-frame={flow ? undefined : viewport}
            data-fragment-light={frameUrl(entry, light, fragment, stepIndex)}
            data-fragment-dark={frameUrl(entry, dark, fragment, stepIndex)}
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
  entry: Extract<CatalogueRecord, { kind: "use-case" }>;
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
                    href={viewHref("screen", screen.id)}
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
  entry: CatalogueRecord;
  fragment?: string | undefined;
  variantId?: string | undefined;
}) {
  const selection = useContext(DisplaySelection);
  if (entry.kind === "page")
    return (
      <div
        className="mbk-stage-embed"
        data-mokly-scroll="embed"
        data-preview-color-scheme="light"
        key={entry.id}
      >
        <iframe
          className="mbk-frag"
          sandbox="allow-same-origin"
          data-mokly-fragment-frame=""
          src={framePath(`static/${entryRoute("page", entry.id)}`, fragment)}
          title={entry.title}
        />
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
      ? (("variantOf" in entry
          ? [entry]
          : catalogueComponentVariants(catalogue, entry.id)
        ).find(
          (variant) => variant.id === (variantId ?? selection.variantId),
        ) ??
          ("variantOf" in entry
            ? entry
            : catalogueComponentVariants(catalogue, entry.id)[0]))!.views
      : (entry as CatalogueScreen).views;
  return (
    <div
      className={`mbk-stage ${entry.kind === "component" ? "mbk-component-stage" : "mbk-live"}`}
      data-mokly-scroll="stage"
      data-mokly-stage=""
      data-viewport={selection.viewport}
      key={`${entry.id}:${variantId ?? ""}`}
    >
      {VIEWPORTS.map((viewport) => (
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
