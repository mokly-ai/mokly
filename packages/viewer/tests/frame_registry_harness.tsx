/** Shared React frame primitives for browser-only registry harnesses. */

import type {
  CatalogueRoutedEntry,
  CatalogueUsage,
  CatalogueView,
} from "../src/catalogue/types.js";
import type { FrameEvent } from "../src/client/frame_adapter.js";
import { useMountedShellFrame } from "../src/shell/frame_mount_hook.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameRegistry,
} from "../src/shell/frame_registry.js";
import { useFrameSource } from "../src/shell/frame_source_hook.js";
import { frameSource } from "../src/shell/stage_sources.js";

/** Mount one real adapter-backed frame into a test-owned registry. */
export function RegistryHarnessFrame({
  entry,
  onEvent,
  usage,
  view,
}: {
  entry: CatalogueRoutedEntry;
  onEvent(event: FrameEvent): void;
  usage: CatalogueUsage;
  view: CatalogueView;
}) {
  const registry = useOptionalShellFrameRegistry();
  const source = frameSource(view);
  const mounted = useMountedShellFrame({
    enabled: true,
    identity: {
      entryId: entry.id,
      route: entry.route,
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
      src={initial}
      style={{ width: 390, height: 300 }}
      title={view.viewport}
    />
  );
}

/** Wait until the expected sessions have completed their current readiness. */
export async function mountedRegistrySessions(
  registry: ShellFrameRegistry,
  count: number,
): Promise<void> {
  while (registry.values().length !== count)
    await new Promise(requestAnimationFrame);
  await Promise.all(registry.values().map((session) => session.ready));
}
