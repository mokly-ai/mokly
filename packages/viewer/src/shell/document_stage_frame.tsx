/**
 * The frame of a whole-document page or Markdown document. This container
 * mounts the frame and derives its sources; `@mokly/ui/preview-frame` draws
 * the frame and `@mokly/ui/scheme-fallback` the Light-only band.
 */

import { useContext, useMemo } from "react";

import { DocumentFrame, PreviewIframe } from "@mokly/ui/preview-frame";
import { LightOnlyBand } from "@mokly/ui/scheme-fallback";

import { currentDocumentPath } from "../catalogue/delivery_paths.js";
import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import { documentRoute } from "../navigation/routes.js";
import { DisplaySelection } from "../viewer/display_context.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameGeneration, useFrameSource } from "./frame_source_hook.js";
import { documentLightOnly } from "./scheme_fallback.js";
import { framePath, unavailableUsage } from "./stage_sources.js";
import { useOptionalShellStore } from "./store_context.js";

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
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const selection = useContext(DisplaySelection);
  const scheme =
    entry.kind === "document" &&
    entry.colorSchemes.includes(selection.colorScheme)
      ? selection.colorScheme
      : "light";
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
    enabled: store?.interactive ?? false,
    generation,
    identity,
    source,
    usage: unavailableUsage,
  });
  const initialSource = useFrameSource(
    mounted.frameRef,
    source,
    registry?.baseUrl,
    Boolean(store?.interactive && registry),
    generation,
  );
  return (
    <>
      {documentLightOnly(entry, hasDarkFragments) ? <LightOnlyBand /> : null}
      <DocumentFrame error={mounted.status === "error"} scheme={scheme}>
        {source ? (
          <PreviewIframe
            busy={mounted.status === "loading"}
            data={{
              "data-mokly-fragment-frame": "",
              "data-mokly-frame-state": mounted.status,
              "data-fragment-light":
                entry.kind === "document"
                  ? framePath(
                      currentDocumentPath(documentRoute(entry.path, "light")),
                      fragment,
                    )
                  : undefined,
              "data-fragment-dark":
                entry.kind === "document" && entry.colorSchemes.includes("dark")
                  ? framePath(
                      currentDocumentPath(documentRoute(entry.path, "dark")),
                      fragment,
                    )
                  : undefined,
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
