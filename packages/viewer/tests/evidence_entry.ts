import type {
  CatalogueReadModel,
  CatalogueUsage,
} from "../src/catalogue/types.js";
import type { FrameEvent } from "../src/client/frame_adapter.js";
import { postMessageAdapter } from "../src/client/post_message_adapter.js";
import { sameOriginAdapter } from "../src/client/same_origin_adapter.js";
import { ViewerFrames } from "../src/viewer/frames.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { InstanceRef } from "../src/viewer/types.js";

type Viewport = "mobile" | "desktop";
type Evidence = "ready" | "empty" | "pending" | "unavailable";
interface EvidenceProbe {
  frames: ViewerFrames;
  instance: InstanceRef;
  events: string[];
  calls: string[];
  mounts: number;
  updates: number;
  hold?: "highlight" | "list";
  geometryDuringHighlight: boolean;
  waiting: boolean;
  release(): void;
  outcome?: string;
  update(viewport: Viewport, evidence?: Evidence): void;
}

declare global {
  interface Window {
    evidence: EvidenceProbe;
    startEvidence(
      model: CatalogueReadModel,
      origin: string,
      cross: boolean,
      sibling: "ready" | "pending",
    ): void;
  }
}

window.startEvidence = (model, origin, cross, sibling) => {
  const root = document.createElement("div");
  root.className = "mokly-viewer";
  root.tabIndex = -1;
  root.innerHTML =
    '<iframe data-workspace-frame="mobile" style="width:390px;height:300px"></iframe><iframe data-workspace-frame="desktop" style="width:390px;height:300px"></iframe><div data-mokly-label-layer></div>';
  document.body.replaceChildren(root);
  const home = model.screens[0]!;
  const original = home.views.map((view) => ({ ...view }));
  const usage = original.find((view) => view.viewport === "mobile")!.usage;
  if (usage.status !== "ready") throw new Error("Expected ready fixture");
  home.views = home.views.map((view) =>
    view.viewport === "desktop" && sibling === "pending"
      ? { ...view, usage: { status: "pending" } }
      : view,
  );
  const selection = { ...defaultSelection, screenId: "home" };
  const adapter = cross
    ? postMessageAdapter({ frameOrigin: origin })
    : sameOriginAdapter();
  const probe: EvidenceProbe = {
    frames: new ViewerFrames(
      root,
      model,
      new URL(cross ? origin : location.origin),
      {
        async mount(frame, options) {
          probe.mounts++;
          const mounted = await adapter.mount(frame, options);
          const viewport = frame.dataset["workspaceFrame"]!;
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
            async updateUsage(next) {
              await mounted.updateUsage!(next);
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
                for (const listener of listeners)
                  listener({ type: "geometry" });
                await new Promise(requestAnimationFrame);
                await new Promise(requestAnimationFrame);
              }
              if (mode !== "off") await hold("highlight");
            },
            async listInstanceBoundaries() {
              probe.calls.push(`${viewport}:list`);
              const boundaries = await mounted.listInstanceBoundaries();
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
        },
      },
      () => ({
        onPickStart: () => probe.events.push("start"),
        onPickEnd: (event) => probe.events.push(`end:${event.reason}`),
        onInstanceClick: (event) =>
          probe.events.push(`click:${event.instance?.viewport}`),
      }),
      () => probe.events.push("navigation"),
      selection,
      (error) => {
        probe.events.push("error");
        return error instanceof Error ? error : new Error("Unexpected failure");
      },
    ),
    instance: {
      screenId: "home",
      viewport: "mobile",
      colorScheme: "light",
      key: usage.instances.find((instance) => instance.id === "action")!.key,
    },
    events: [],
    calls: [],
    mounts: 0,
    updates: 0,
    geometryDuringHighlight: false,
    waiting: false,
    release: () => {},
    update(viewport, evidence = "ready") {
      home.views = home.views.map((view) => {
        if (view.viewport !== viewport) return view;
        const usage: CatalogueUsage =
          evidence === "ready"
            ? structuredClone(
                original.find((item) => item.viewport === viewport)!.usage,
              )
            : evidence === "empty"
              ? { status: "ready", instances: [], slots: [], ranges: [] }
              : { status: evidence };
        return { ...view, usage };
      });
      probe.frames.update(selection);
    },
  };
  window.evidence = probe;
  probe.frames.update(selection);
};
