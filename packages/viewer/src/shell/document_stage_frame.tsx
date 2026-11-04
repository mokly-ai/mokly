/**
 * The frame of a whole-document page or Markdown document. This container
 * mounts the frame and derives its sources; `@mokly/ui/preview-frame` draws
 * the frame and `@mokly/ui/scheme-fallback` the Light-only band.
 */

import { useContext, useMemo, useRef } from "react";

import { currentDocumentPath } from "@mokly/model";
import { DocumentFrame, PreviewIframe } from "@mokly/ui/preview-frame";
import { LightOnlyBand } from "@mokly/ui/scheme-fallback";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import { documentRoute } from "../navigation/routes.js";

import { DisplaySelection } from "./display_context.js";
import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { useShellRoot } from "./root_context.js";
import { documentLightOnly, schemeValue } from "./scheme_fallback.js";
import { framePath, unavailableUsage } from "./stage_sources.js";
import { useShellStore } from "./store_context.js";

/** A whole-document page with the same adapter-owned logical navigation. */
export function DocumentStageFrame({
  entry,
  fragment,
  hasDarkFragments,
}: {
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "page" | "document" }>;
  fragment?: string;
  hasDarkFragments: boolean;
}) {
  const elements = useShellRoot()?.elements;
  const localStage = useRef<HTMLDivElement>(null);
  const stage = elements?.scrolls.ref("embed") ?? localStage;
  const store = useShellStore();
  const registry = useOptionalShellFrameRegistry();
  const selection = useContext(DisplaySelection);
  const scheme = schemeValue<"dark" | "light">(
    selection.colorScheme,
    "light",
    entry.kind === "document" && entry.colorSchemes.includes("dark")
      ? "dark"
      : undefined,
  );
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
  return (
    <>
      {documentLightOnly(entry, hasDarkFragments) ? <LightOnlyBand /> : null}
      <DocumentFrame
        error={mounted.status === "error"}
        ref={stage}
        scheme={scheme}
      >
        {source ? (
          <PreviewIframe
            busy={mounted.status === "loading"}
            data={{
              "data-mokly-fragment-frame": "",
              "data-mokly-frame-state": mounted.status,
            }}
            key={generation}
            ref={mounted.frameRef}
            src={initialSource}
            title={entry.title}
          />
        ) : null}
      </DocumentFrame>
    </>
  );
}

/** The document key of a page, or of one scheme's render of a document. */
export function documentKeyOf(
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "page" | "document" }>,
  scheme: "dark" | "light",
): string | undefined {
  return entry.kind === "page"
    ? entry.documentKey
    : entry.documentKeys.find((key) => key.colorScheme === scheme)?.documentKey;
}
