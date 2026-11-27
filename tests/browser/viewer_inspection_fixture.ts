import type { Page } from "@playwright/test";

import type {
  CatalogueReadModel,
  FrameEvent,
  InstanceRef,
} from "@mokly/viewer";

import type {} from "./viewer_harness.js";

type Operation = "list" | "highlight" | "scroll";
interface InspectionProbe {
  hold?: Operation;
  waiting: boolean;
  release: (fail: boolean) => void;
  /** Deliver an event to the mobile viewer session as its preview would. */
  emit: (event: FrameEvent) => void;
  calls: { viewport: string; operation: string }[];
  outcome?: string;
  instance: InstanceRef;
}
declare global {
  interface Window {
    inspectionProbe: InspectionProbe;
  }
}

/**
 * Real same-origin adapter work with delayed completion and explicitly
 * triggered geometry.
 */
export async function startInspection(
  page: Page,
  sibling?: "pending" | "unavailable" | "mounting",
): Promise<void> {
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate((sibling) => {
    const host = window.viewerHarness.start("one", {
      defaultSelection: { viewport: sibling ? "both" : "mobile" },
    });
    const catalogue = structuredClone(host.props.index) as CatalogueReadModel;
    const home = host.details["home"]!;
    const usage = home.views.find((view) => view.viewport === "mobile")!.usage;
    if (usage.status !== "ready") throw new Error("Expected ready fixture");
    if (sibling && sibling !== "mounting")
      for (const view of home.views)
        if (view.viewport === "desktop") view.usage = { status: sibling };
    const probe: InspectionProbe = {
      waiting: false,
      release: () => {},
      emit: () => {},
      calls: [],
      instance: {
        screenPath: "home",
        viewport: "mobile",
        colorScheme: "light",
        key: usage.instances.find((instance) => instance.id === "action")!.key,
      },
    };
    window.inspectionProbe = probe;
    const original = host.props.frameAdapter!;
    host.props.index = catalogue;
    /**
     * Pass a preview event on unless it is the preview's own geometry. The
     * viewer receives events through the mount-time `onEvent` and then
     * adopts it by subscribing that same callback, so the filtered `onEvent`
     * must also be the callback the adapter sees adopted.
     */
    const withoutGeometry =
      (listener: (event: FrameEvent) => void) => (event: FrameEvent) => {
        if (event.type !== "geometry") listener(event);
      };
    host.props.frameAdapter = {
      async mount(frame, options) {
        const viewport = frame.dataset["workspaceFrame"]!;
        // The canvas also shows each view's Dark frame. The probe follows
        // the Light frames, as the one-frame stage shows them under a light
        // selection, while every frame withholds its own geometry.
        const probed = frame.dataset["workspaceColorScheme"] !== "dark";
        const receiver = options.onEvent;
        const onEvent = receiver && withoutGeometry(receiver);
        const mounted = await original.mount(
          frame,
          onEvent ? { ...options, onEvent } : options,
        );
        const hold = async () => {
          probe.waiting = true;
          await new Promise<void>((resolve, reject) => {
            probe.release = (fail) => {
              if (fail) reject(new Error("Delayed old-frame failure"));
              else resolve();
            };
          });
        };
        if (probed && viewport === "desktop" && sibling === "mounting")
          await hold();
        const after = async (operation: Operation) => {
          if (probed && viewport === "mobile" && probe.hold === operation) {
            delete probe.hold;
            await hold();
          }
        };
        const record = (operation: string) => {
          if (probed) probe.calls.push({ viewport, operation });
        };
        return {
          ...mounted,
          async listInstanceBoundaries() {
            record("list");
            const boundaries = await mounted.listInstanceBoundaries();
            await after("list");
            return boundaries;
          },
          async highlight(keys, mode) {
            record(mode);
            await mounted.highlight(keys, mode);
            if (mode !== "off") await after("highlight");
          },
          async scrollTo(key) {
            record("scroll");
            await mounted.scrollTo(key);
            await after("scroll");
          },
          subscribe(listener) {
            if (probed && viewport === "mobile") probe.emit = listener;
            return mounted.subscribe(
              onEvent && listener === receiver
                ? onEvent
                : withoutGeometry(listener),
            );
          },
        };
      },
    };
    host.render();
  }, sibling);
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

export async function releaseInspection(
  page: Page,
  fail: boolean,
): Promise<void> {
  await page.evaluate(async (fail) => {
    window.inspectionProbe.release(fail);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }, fail);
}
