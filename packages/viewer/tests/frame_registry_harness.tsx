/** Shared React frame primitives for browser-only registry harnesses. */

import { useContext } from "react";

import type { FrameEvent } from "@mokly/frame";
import type { CatalogueUsage } from "@mokly/model";

import type { ShellCatalogueView } from "../src/catalogue/scoped_types.js";
import { FrameStageContext } from "../src/shell/frame_layout_context.js";
import { useMountedShellFrame } from "../src/shell/frame_mount_hook.js";
import { useOptionalShellFrameRegistry } from "../src/shell/frame_registry.js";
import { useFrameSource } from "../src/shell/frame_source_hook.js";
import { frameSource } from "../src/shell/stage_sources.js";

/** Mount one real adapter-backed frame into a test-owned registry. */
export function RegistryHarnessFrame({
  entry,
  onEvent,
  usage,
  view,
}: {
  entry: { path: string; kind: "component" | "screen" };
  onEvent(event: FrameEvent): void;
  usage: CatalogueUsage;
  view: ShellCatalogueView;
}) {
  const registry = useOptionalShellFrameRegistry();
  const stage = useContext(FrameStageContext);
  const source = frameSource(entry, view);
  const mounted = useMountedShellFrame({
    enabled: true,
    layout: { expanded: false, stage },
    identity: {
      entryPath: entry.path,
      viewport: view.viewport,
      colorScheme: view.colorScheme,
    },
    onEvent,
    source,
    usage,
  });
  const initial = useFrameSource(mounted.frameRef, source, registry?.baseUrl);
  return (
    <iframe
      data-workspace-frame={view.viewport}
      ref={mounted.frameRef}
      sandbox="allow-same-origin"
      src={initial}
      style={{ width: 390, height: 300 }}
      title={view.viewport}
    />
  );
}
