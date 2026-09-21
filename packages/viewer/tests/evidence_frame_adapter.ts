/** Adapter instrumentation for retained-evidence browser coverage. */

import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "../src/client/frame_adapter.js";

interface EvidenceAdapterProbe {
  calls: string[];
  geometryDuringHighlight: boolean;
  geometryDuringList: boolean;
  hold?: "highlight" | "list";
  mounts: number;
  release(): void;
  updates: number;
  waiting: boolean;
}

/** Count mounts and expose controllable adapter operation boundaries. */
export function evidenceAdapter(
  adapter: FrameAdapter,
  probe: EvidenceAdapterProbe,
): FrameAdapter {
  return {
    async mount(frame, options) {
      probe.mounts++;
      const mounted = await adapter.mount(frame, options);
      return instrumentMounted(
        mounted,
        frame.dataset["workspaceFrame"]!,
        probe,
      );
    },
  };
}

function instrumentMounted(
  mounted: MountedFrame,
  viewport: string,
  probe: EvidenceAdapterProbe,
): MountedFrame {
  const listeners = new Set<(event: FrameEvent) => void>();
  const hold = async (operation: "highlight" | "list") => {
    if (viewport !== "mobile" || probe.hold !== operation) return;
    delete probe.hold;
    probe.waiting = true;
    await new Promise<void>((resolve) => {
      probe.release = resolve;
    });
  };
  return {
    ...mounted,
    async updateUsage(usage) {
      await mounted.updateUsage!(usage);
      probe.updates++;
    },
    async highlight(keys, mode) {
      probe.calls.push(`${viewport}:${mode}`);
      await mounted.highlight(keys, mode);
      if (
        viewport === "mobile" &&
        mode !== "off" &&
        probe.geometryDuringHighlight
      ) {
        probe.geometryDuringHighlight = false;
        for (const listener of listeners) listener({ type: "geometry" });
        await twoFrames();
      }
      if (mode !== "off") await hold("highlight");
    },
    async listInstanceBoundaries() {
      probe.calls.push(`${viewport}:list`);
      const boundaries = await mounted.listInstanceBoundaries();
      if (viewport === "mobile" && probe.geometryDuringList) {
        probe.geometryDuringList = false;
        for (const listener of listeners) listener({ type: "geometry" });
        await twoFrames();
      }
      await hold("list");
      return boundaries;
    },
    subscribe(listener) {
      listeners.add(listener);
      const unsubscribe = mounted.subscribe(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    },
  };
}

async function twoFrames(): Promise<void> {
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
}
