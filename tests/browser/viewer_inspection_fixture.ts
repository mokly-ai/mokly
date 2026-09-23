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
  waitingOperations: Operation[];
  release: (fail: boolean) => void;
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
        waitingOperations: [],
        release: () => {},
        emit: () => {},
        calls: [],
        instance: {
          screenId: "home",
          viewport: "mobile",
          colorScheme: "light",
          key: usage.instances.find((instance) => instance.id === "action")!
            .key,
        },
      };
      const releases: ((fail: boolean) => void)[] = [];
      probe.release = (fail) => {
        for (const release of releases.splice(0)) release(fail);
      };
      window.inspectionProbe = probe;
      const original = host.props.frameAdapter!;
      host.props.catalogue = catalogue;
      host.props.frameAdapter = {
        async mount(frame, options) {
          const mounted = await original.mount(frame, options);
          const viewport = frame.dataset["workspaceFrame"]!;
          const hold = async (operation?: Operation) => {
            probe.waiting = true;
            if (operation) probe.waitingOperations.push(operation);
            await new Promise<void>((resolve, reject) => {
              releases.push((fail) => {
                if (fail) reject(new Error("Delayed old-frame failure"));
                else resolve();
              });
            });
          };
          if (viewport === "desktop" && sibling === "mounting") await hold();
          const after = async (operation: Operation) => {
            if (viewport === "mobile" && probe.hold === operation) {
              delete probe.hold;
              await hold(operation);
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
              return mounted.subscribe((event) => {
                if (event.type !== "geometry") listener(event);
              });
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
