import type {
  CatalogueReadModel,
  CatalogueUsage,
} from "../src/catalogue/types.js";
import { postMessageAdapter } from "../src/client/post_message_adapter.js";
import { sameOriginAdapter } from "../src/client/same_origin_adapter.js";
import { ViewerFrames } from "../src/viewer/frames.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { InstanceRef } from "../src/viewer/types.js";

export interface ReadinessProbe {
  frames: ViewerFrames;
  instance: InstanceRef;
  events: string[];
  mounts: number;
  update(): void;
}

declare global {
  interface Window {
    readiness: ReadinessProbe;
    startReadiness(
      model: CatalogueReadModel,
      origin: string,
      cross: boolean,
      status: "pending" | "unavailable",
    ): void;
  }
}

window.startReadiness = (model, origin, cross, status) => {
  const root = document.createElement("div");
  root.className = "mokly-viewer";
  root.innerHTML =
    '<iframe data-workspace-frame="mobile" style="width:390px;height:300px"></iframe><iframe data-workspace-frame="desktop" style="width:390px;height:300px"></iframe><div data-mokly-label-layer></div>';
  document.body.replaceChildren(root);
  const home = model.screens[0]!;
  const mobile = home.views.find((view) => view.viewport === "mobile")!;
  const desktop = home.views.find((view) => view.viewport === "desktop")!;
  const ready: CatalogueUsage = desktop.usage;
  desktop.usage = { status };
  if (mobile.usage.status !== "ready")
    throw new Error("Expected ready fixture");
  const selection = { ...defaultSelection, screenId: "home" };
  const adapter = cross
    ? postMessageAdapter({ frameOrigin: origin })
    : sameOriginAdapter();
  const probe: ReadinessProbe = {
    frames: new ViewerFrames(
      root,
      model,
      new URL(cross ? origin : location.origin),
      {
        mount(frame, view) {
          probe.mounts++;
          return adapter.mount(frame, view);
        },
      },
      () => ({
        onInstanceHover: (event) =>
          probe.events.push(`hover:${event.instance?.viewport ?? "none"}`),
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
      key: mobile.usage.instances.find((instance) => instance.id === "action")!
        .key,
    },
    events: [],
    mounts: 0,
    update() {
      home.views = home.views.map((view) =>
        view === desktop ? { ...view, usage: ready } : view,
      );
      probe.frames.update(selection);
    },
  };
  window.readiness = probe;
  probe.frames.update(selection);
};
