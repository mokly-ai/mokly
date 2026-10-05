/** A whole-document page frame with adapter-owned logical navigation. */

import { useContext, useMemo } from "react";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import { documentRoute } from "../navigation/routes.js";
import { DisplaySelection } from "../viewer/display_context.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameSource } from "./frame_source_hook.js";
import { documentLightOnly, LightOnlyBand } from "./scheme_fallback.js";
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
