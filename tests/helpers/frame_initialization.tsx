/** Deliver evidence in the last microtask of a real React frame mount. */

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { CatalogueUsage } from "../../packages/viewer/src/catalogue/types.js";
import type { FrameAdapter } from "../../packages/viewer/src/client/frame_adapter.js";
import { useMountedShellFrame } from "../../packages/viewer/src/shell/frame_mount_hook.js";
import {
  ShellFrameRegistryProvider,
  useOptionalShellFrameRegistry,
  type ShellFrameRegistry,
} from "../../packages/viewer/src/shell/frame_registry.js";

export interface InitializationReport {
  appliedStatus: CatalogueUsage["status"];
  error: string | undefined;
  sessionStatus: string;
  updates: CatalogueUsage["status"][];
  usageRevision: number;
  usageStatus: CatalogueUsage["status"];
}

declare global {
  interface Window {
    runFrameInitialization(): Promise<InitializationReport>;
  }
}

window.runFrameInitialization = async () => {
  const element = document.createElement("section");
  document.body.append(element);
  const root = createRoot(element);
  let registry: ShellFrameRegistry | undefined;
  let latest: CatalogueUsage = { status: "unavailable" };
  let applied: CatalogueUsage = latest;
  let handedOff = false;
  const updates: CatalogueUsage["status"][] = [];
  const adapter: FrameAdapter = {
    async mount(_frame, view) {
      applied = view.usage;
      return {
        dispose() {},
        async highlight() {
          if (applied.status !== "ready")
            throw new Error("Frame inspection: unavailable");
        },
        listInstanceBoundaries: async () => [],
        scrollTo: async () => {},
        subscribe() {
          if (!handedOff) {
            handedOff = true;
            queueMicrotask(() => {
              latest = {
                status: "ready",
                instances: [],
                ranges: [],
                slots: [],
              };
              flushSync(render);
            });
          }
          return () => {};
        },
        async updateUsage(usage) {
          updates.push(usage.status);
          applied = usage;
        },
      };
    },
  };
  function Frame() {
    registry = useOptionalShellFrameRegistry();
    const mounted = useMountedShellFrame({
      enabled: true,
      identity: { entryId: "initialization" },
      source: "/static/initialization.html",
      usage: latest,
    });
    return <iframe ref={mounted.frameRef} src="about:blank" title="Frame" />;
  }
  function render() {
    root.render(
      <ShellFrameRegistryProvider
        adapter={adapter}
        baseUrl="https://fixture.example/"
      >
        <Frame />
      </ShellFrameRegistryProvider>,
    );
  }
  try {
    flushSync(render);
    await new Promise(requestAnimationFrame);
    const session = registry?.values()[0];
    if (!session) throw new Error("The frame session was not mounted.");
    await session.ready;
    let error: string | undefined;
    try {
      await session.mounted?.highlight([], "pick");
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    return {
      appliedStatus: applied.status,
      error,
      sessionStatus: session.status,
      updates,
      usageRevision: session.usageRevision,
      usageStatus: session.usage.status,
    };
  } finally {
    root.unmount();
    element.remove();
  }
};
