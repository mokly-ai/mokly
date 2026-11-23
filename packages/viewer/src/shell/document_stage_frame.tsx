/**
 * The frame of a whole-document page or Markdown document. This container
 * mounts the frame and derives its sources; `@mokly/ui/preview-frame` draws
 * the frame and `@mokly/ui/scheme-fallback` the Light-only band.
 */

import { useContext, useMemo, useRef } from "react";
import type { RefObject } from "react";

import { currentDocumentPath } from "@mokly/model";
import { DocumentFrame, PreviewIframe } from "@mokly/ui/preview-frame";
import { LightOnlyBand } from "@mokly/ui/scheme-fallback";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { ViewerSelection } from "../host/types.js";
import { documentRoute } from "../navigation/routes.js";

import { DisplaySelection } from "./display_context.js";
import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { focusThen, useRetryContent } from "./retry_focus.js";
import { useShellRoot } from "./root_context.js";
import { documentLightOnly, schemeValue } from "./scheme_fallback.js";
import { framePath, unavailableUsage } from "./stage_sources.js";
import { useShellStore } from "./store_context.js";

/** A page or a Markdown document, whose one document stands in a frame. */
export type DocumentEntry = Extract<
  ShellCatalogueRoutedEntry,
  { kind: "page" | "document" }
>;

/**
 * The scheme of a document's shown render: the preview scheme, or Light
 * for a page and for a document without a dark render.
 */
export function documentScheme(
  entry: DocumentEntry,
  colorScheme: ViewerSelection["colorScheme"],
): "dark" | "light" {
  return schemeValue<"dark" | "light">(
    colorScheme,
    "light",
    entry.kind === "document" && entry.colorSchemes.includes("dark")
      ? "dark"
      : undefined,
  );
}

/**
 * Mount a document's frame through its adapter, with the same logical
 * navigation as a view's frame.
 */
export function useDocumentFrame(
  entry: DocumentEntry,
  scheme: "dark" | "light",
  fragment: string | undefined,
  stage: RefObject<HTMLDivElement | null> | undefined,
) {
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const source = framePath(
    currentDocumentPath(documentRoute(entry.path, scheme)),
    fragment,
  );
  const identity = useMemo<ShellFrameIdentity>(
    () => ({ entryPath: entry.path }),
    [entry.path],
  );
  const generation = useFrameGeneration(source, documentKeyOf(entry, scheme));
  const mounted = useMountedShellFrame({
    enabled: store.interactive,
    generation,
    identity,
    layout: { stage, expanded: false },
    sources:
      entry.kind === "document"
        ? entry.colorSchemes.map((colorScheme) =>
            framePath(
              currentDocumentPath(documentRoute(entry.path, colorScheme)),
              fragment,
            ),
          )
        : [],
    source,
    usage: unavailableUsage,
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    Boolean(store.interactive && registry),
    generation,
  );
  useRetryContent(mounted.frameRef);
  return { ...mounted, generation, initialSource, source };
}

/** A whole-document page with the same adapter-owned logical navigation. */
export function DocumentStageFrame({
  entry,
  fragment,
  hasDarkFragments,
}: {
  entry: DocumentEntry;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  const elements = useShellRoot()?.elements;
  const localStage = useRef<HTMLDivElement>(null);
  const stage = elements?.scrolls.ref("embed") ?? localStage;
  const selection = useContext(DisplaySelection);
  const scheme = documentScheme(entry, selection.colorScheme);
  const mounted = useDocumentFrame(entry, scheme, fragment, stage);
  return (
    <>
      {documentLightOnly(entry, hasDarkFragments) ? <LightOnlyBand /> : null}
      <DocumentFrame
        error={mounted.status === "error"}
        ref={stage}
        retry={{ onClick: focusThen(mounted.frameRef, mounted.retry) }}
        scheme={scheme}
      >
        {mounted.source ? (
          <PreviewIframe
            busy={mounted.status === "loading"}
            data={{
              "data-mokly-fragment-frame": "",
              "data-mokly-frame-state": mounted.status,
            }}
            key={mounted.generation}
            ref={mounted.frameRef}
            src={mounted.initialSource}
            title={entry.title}
          />
        ) : null}
      </DocumentFrame>
    </>
  );
}

/** The document key of a page, or of one scheme's render of a document. */
export function documentKeyOf(
  entry: DocumentEntry,
  scheme: "dark" | "light",
): string | undefined {
  return entry.kind === "page"
    ? entry.documentKey
    : entry.documentKeys.find((key) => key.colorScheme === scheme)?.documentKey;
}
