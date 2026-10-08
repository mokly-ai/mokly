/** Shared React frame primitives for browser-only registry harnesses. */

import type {
  CatalogueRecord,
  CatalogueUsage,
  CatalogueView,
} from "../src/catalogue/types.js";
import type { FrameEvent } from "../src/client/frame_adapter.js";
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
  entry: Extract<CatalogueRecord, { kind: "component" | "screen" }>;
  onEvent(event: FrameEvent): void;
  usage: CatalogueUsage;
  view: CatalogueView;
}) {
  const registry = useOptionalShellFrameRegistry();
  const source = frameSource(entry, view);
  const mounted = useMountedShellFrame({
    enabled: true,
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
