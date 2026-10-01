/** A whole-document page frame with adapter-owned logical navigation. */

import { useMemo } from "react";

import type { CatalogueRecord } from "../catalogue/types.js";
import { entryRoute } from "../navigation/routes.js";

import { useMountedShellFrame } from "./frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameIdentity,
} from "./frame_registry.js";
import { useFrameSource } from "./frame_source_hook.js";
import { framePath, unavailableUsage } from "./stage_sources.js";
import { useOptionalShellStore } from "./store_context.js";

/** A whole-document page with the same adapter-owned logical navigation. */
export function DocumentStageFrame({
  entry,
  fragment,
}: {
  entry: Extract<CatalogueRecord, { kind: "page" }>;
  fragment?: string;
}) {
  const store = useOptionalShellStore();
  const registry = useOptionalShellFrameRegistry();
  const source = framePath(`static/${entryRoute("page", entry.id)}`, fragment);
  const identity = useMemo<ShellFrameIdentity>(
    () => ({ entryId: entry.id }),
    [entry.id],
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
    <div
      className="mbk-stage-embed"
      data-mokly-scroll="embed"
      data-preview-color-scheme="light"
    >
      {source ? (
        <iframe
          aria-busy={mounted.status === "loading" ? true : undefined}
          className="mbk-frag"
          data-mokly-fragment-frame=""
          data-mokly-frame-state={mounted.status}
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
  );
}
