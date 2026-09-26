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
  /** Geometry reports the previews sent, which the viewer never receives. */
  withheldGeometry: number;
  calls: { viewport: string; operation: string }[];
  outcome?: string;
  instance: InstanceRef;
}
declare global {
  interface Window {
    inspectionProbe: InspectionProbe;
  }
}

/** Real adapter work with delayed completion and explicitly triggered geometry. */
export async function startInspection(
  page: Page,
  cross: boolean,
  sibling?: "pending" | "unavailable" | "mounting",
): Promise<void> {
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, sibling }) => {
      const host = window.viewerHarness.start("one", {
        cross,
        defaultSelection: { viewport: sibling ? "both" : "mobile" },
      });
      const catalogue = structuredClone(
        host.props.catalogue,
      ) as CatalogueReadModel;
      const home = catalogue.screens.find((entry) => entry.id === "home")!;
      const usage = home.views.find(
        (view) => view.viewport === "mobile",
      )!.usage;
      if (usage.status !== "ready") throw new Error("Expected ready fixture");
      if (sibling && sibling !== "mounting")
        for (const view of home.views)
          if (view.viewport === "desktop") view.usage = { status: sibling };
      const probe: InspectionProbe = {
        waiting: false,
        release: () => {},
        emit: () => {},
        withheldGeometry: 0,
        calls: [],
        instance: {
          screenId: "home",
          viewport: "mobile",
          colorScheme: "light",
          key: usage.instances.find((instance) => instance.id === "action")!
            .key,
        },
      };
      window.inspectionProbe = probe;
      const original = host.props.frameAdapter!;
      host.props.catalogue = catalogue;
      /**
       * Pass a preview event on unless it is the preview's own geometry. The
       * viewer receives events through the mount-time `onEvent` and then
       * adopts it by subscribing that same callback, so the filtered `onEvent`
       * must also be the callback the adapter sees adopted.
       */
      const withoutGeometry =
        (listener: (event: FrameEvent) => void) => (event: FrameEvent) => {
          if (event.type === "geometry") probe.withheldGeometry += 1;
          else listener(event);
        };
      host.props.frameAdapter = {
        async mount(frame, options) {
          const viewport = frame.dataset["workspaceFrame"]!;
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
          if (viewport === "desktop" && sibling === "mounting") await hold();
          const after = async (operation: Operation) => {
            if (viewport === "mobile" && probe.hold === operation) {
              delete probe.hold;
              await hold();
            }
          };
          return {
            ...mounted,
            async listInstanceBoundaries() {
              probe.calls.push({ viewport, operation: "list" });
              const boundaries = await mounted.listInstanceBoundaries();
              await after("list");
              return boundaries;
            },
            async highlight(keys, mode) {
              probe.calls.push({ viewport, operation: mode });
              await mounted.highlight(keys, mode);
              if (mode !== "off") await after("highlight");
            },
            async scrollTo(key) {
              probe.calls.push({ viewport, operation: "scroll" });
              await mounted.scrollTo(key);
              await after("scroll");
            },
            subscribe(listener) {
              if (viewport === "mobile") probe.emit = listener;
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
    },
    { cross, sibling },
  );
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
