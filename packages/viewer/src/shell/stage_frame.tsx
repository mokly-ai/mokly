/** Live React frame chrome over the transport adapters. */

import { useContext, useMemo } from "react";

import type {
  AnyShellCatalogueEntry,
  AnyShellCatalogueView,
} from "../catalogue/scoped_types.js";
import { temporaryPreviewAdapter } from "../client/same_origin_adapter.js";
import type { GeneratedComponentView } from "../components/views.js";
import { entryRoute, documentRoute } from "../navigation/routes.js";
import { DisplaySelection } from "../viewer/display_context.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameSource } from "./frame_source_hook.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import { documentLightOnly, LightOnlyBand } from "./scheme_fallback.js";
import {
  framePath,
  frameSource,
  generatedFrameSource,
  generatedUsage,
  generatedView,
  shellFrameUsage,
  unavailableUsage,
} from "./stage_sources.js";
import { useOptionalShellStore } from "./store_context.js";

/** A selected, adapter-owned screen or component preview. */
export function StageFrame({
  entry,
  flow = false,
  fragment,
  hasDarkFragments,
  previewViews,
  stepIndex,
  variantPath,
  views,
  viewport,
}: {
  entry: Extract<AnyShellCatalogueEntry, { kind: "component" | "screen" }>;
  flow?: boolean;
  fragment?: string;
  hasDarkFragments: boolean;
  previewViews?: readonly GeneratedComponentView[];
  stepIndex?: number;
  variantPath?: string;
  views: readonly AnyShellCatalogueView[];
  viewport: "desktop" | "mobile";
}) {
  const selection = useContext(DisplaySelection);
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const light = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "light",
  );
  const dark = views.find(
    (view) => view.viewport === viewport && view.colorScheme === "dark",
  );
  const previewLight = generatedView(
    previewViews,
    variantPath,
    viewport,
    "light",
  );
  const previewDark = generatedView(
    previewViews,
    variantPath,
    viewport,
    "dark",
  );
  const selected = selection.colorScheme === "dark" ? (dark ?? light) : light;
  const preview =
    selection.colorScheme === "dark"
      ? (previewDark ?? previewLight)
      : previewLight;
  const source = preview
    ? generatedFrameSource(preview, fragment, stepIndex)
    : frameSource(entry, selected, fragment, stepIndex);
  const temporary =
    preview?.path.startsWith("/__mokly/components/renders/") ?? false;
  const previewAdapter = useMemo(temporaryPreviewAdapter, []);
  const identity = useMemo<ShellFrameIdentity>(
    () => ({
      entryPath: entry.path,
      viewport,
      ...(preview || selected
        ? { colorScheme: preview?.colorScheme ?? selected!.colorScheme }
        : {}),
      ...(stepIndex === undefined ? {} : { stepIndex }),
      ...(variantPath ? { variantPath } : {}),
    }),
    [entry.path, preview, selected, stepIndex, variantPath, viewport],
  );
  const mounted = useMountedShellFrame({
    ...(temporary ? { adapter: previewAdapter } : {}),
    enabled: store?.interactive ?? false,
    identity,
    source,
    usage: preview ? generatedUsage(preview) : shellFrameUsage(selected?.usage),
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    temporary || Boolean(store?.interactive && registry),
  );
  const component = entry.kind === "component";
  const frame = source ? (
    <iframe
      aria-busy={mounted.status === "loading" ? true : undefined}
      className="mbk-frag"
      data-mokly-fragment-frame={!flow || stepIndex === 0 ? "" : undefined}
      data-mokly-frame-state={mounted.status}
      data-workspace-frame={flow ? undefined : viewport}
      data-fragment-light={
        hasDarkFragments
          ? previewLight
            ? generatedFrameSource(previewLight, fragment, stepIndex)
            : frameSource(entry, light, fragment, stepIndex)
          : undefined
      }
      data-fragment-dark={
        hasDarkFragments
          ? previewDark
            ? generatedFrameSource(previewDark, fragment, stepIndex)
            : frameSource(entry, dark, fragment, stepIndex)
          : undefined
      }
      ref={mounted.frameRef}
      sandbox="allow-same-origin"
      src={initialSource}
      title={`${entry.title} — ${viewport}`}
    />
  ) : null;
  const framed = component ? (
    frame
  ) : viewport === "mobile" ? (
    <PhoneFrame>{frame}</PhoneFrame>
  ) : (
    <BrowserFrame
      address={entry.address ?? entryRoute(entry.path)}
      frameKey={frameIdentityKey(identity)}
    >
      {frame}
    </BrowserFrame>
  );
  return (
    <div
      className={
        flow
          ? "mbk-flow-screen"
          : `${component ? "mbk-component-canvas" : "mbk-frame-wrap"} mbk-frame-${viewport}`
      }
      data-color-scheme-fallback={
        hasDarkFragments && !previewDark && !dark ? "" : undefined
      }
      data-preview-color-scheme={
        preview?.colorScheme ?? selected?.colorScheme ?? "light"
      }
    >
      {!flow ? (
        <FrameLabel
          fallback={hasDarkFragments && !previewDark && !dark}
          viewport={viewport}
        />
      ) : null}
      {framed ?? <p className="mbk-empty">This preview is unavailable.</p>}
      {mounted.status === "error" ? (
        <p className="mbk-frame-error" role="status">
          This preview could not be loaded.
        </p>
      ) : null}
    </div>
  );
}

/** A whole-document page with the same adapter-owned logical navigation. */
export function DocumentStageFrame({
  entry,
  fragment,
  hasDarkFragments,
}: {
  entry: Extract<AnyShellCatalogueEntry, { kind: "page" | "document" }>;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const selection = useContext(DisplaySelection);
  const scheme =
    entry.kind === "document" &&
    entry.colorSchemes.includes(selection.colorScheme)
      ? selection.colorScheme
      : "light";
  const source = framePath(
    `static/${documentRoute(entry.path, scheme)}`,
    fragment,
  );
  const identity = useMemo<ShellFrameIdentity>(
    () => ({ entryPath: entry.path }),
    [entry.path],
  );
  const mounted = useMountedShellFrame({
    enabled: store?.interactive ?? false,
    identity,
    source,
    usage: unavailableUsage,
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    Boolean(store?.interactive && registry),
  );
  return (
    <>
      {documentLightOnly(entry, hasDarkFragments) ? <LightOnlyBand /> : null}
      <div
        className="mbk-stage-embed"
        data-mokly-scroll="embed"
        data-preview-color-scheme={scheme}
      >
        {source ? (
          <iframe
            aria-busy={mounted.status === "loading" ? true : undefined}
            className="mbk-frag"
            data-mokly-fragment-frame=""
            data-mokly-frame-state={mounted.status}
            data-fragment-light={
              entry.kind === "document"
                ? framePath(
                    `static/${documentRoute(entry.path, "light")}`,
                    fragment,
                  )
                : undefined
            }
            data-fragment-dark={
              entry.kind === "document" && entry.colorSchemes.includes("dark")
                ? framePath(
                    `static/${documentRoute(entry.path, "dark")}`,
                    fragment,
                  )
                : undefined
            }
            ref={mounted.frameRef}
            sandbox="allow-same-origin"
            src={initialSource}
            title={entry.title}
          />
        ) : (
          <p className="mbk-empty">This preview is unavailable.</p>
        )}
        {mounted.status === "error" ? (
          <p className="mbk-frame-error" role="status">
            This preview could not be loaded.
          </p>
        ) : null}
      </div>
    </>
  );
}

function FrameLabel({
  fallback,
  viewport,
}: {
  fallback: boolean;
  viewport: "desktop" | "mobile";
}) {
  return (
    <p className="mbk-frame-label">
      {viewport === "mobile" ? "Mobile" : "Desktop"}
      {fallback ? (
        <span className="mbk-frame-scheme-note">{" — Light only"}</span>
      ) : null}
    </p>
  );
}

function frameIdentityKey(identity: ShellFrameIdentity): string {
  return JSON.stringify([
    identity.entryPath,
    identity.variantPath,
    identity.stepIndex,
    identity.viewport,
  ]);
}
