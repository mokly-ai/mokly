import { expect, test } from "@playwright/test";

import type { FrameEvent, MoklyViewerProps } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

interface TeardownProbe {
  counts: {
    mounted: number;
    aborted: number;
    disposed: number;
    unsubscribed: number;
  };
  emit: (event: FrameEvent) => void;
  original: Error;
  caught: unknown[];
  resize: Map<ResizeObserver, Set<Element>>;
  separator?: HTMLElement;
  value?: string | null;
}
interface ProbeWindow extends Window {
  teardown: TeardownProbe;
}
let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  for (const replacement of ["source", "adapter"] as const) {
    test(`${cross ? "postMessage" : "same-origin"} throwing pick-end cannot interrupt ${replacement} teardown`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(fixture.host.url);
      await page.waitForFunction(() => Boolean(window.viewerHarness));
      await page.evaluate((cross) => {
        const probe: TeardownProbe = {
          counts: { mounted: 0, aborted: 0, disposed: 0, unsubscribed: 0 },
          emit: () => {},
          original: new Error("Host pick-end failure"),
          caught: [],
          resize: new Map(),
        };
        (window as unknown as ProbeWindow).teardown = probe;
        const Original = window.ResizeObserver;
        window.ResizeObserver = class extends Original {
          override observe(target: Element, options?: ResizeObserverOptions) {
            if (!probe.resize.has(this)) probe.resize.set(this, new Set());
            probe.resize.get(this)!.add(target);
            super.observe(target, options);
          }
          override unobserve(target: Element) {
            probe.resize.get(this)?.delete(target);
            super.unobserve(target);
          }
          override disconnect() {
            probe.resize.delete(this);
            super.disconnect();
          }
        };
        window.addEventListener("error", (event) => {
          probe.caught.push(event.error);
        });
        const host = window.viewerHarness.start("one", { cross, slots: true });
        const original = host.props.frameAdapter!;
        host.props.frameAdapter = {
          async mount(frame, options) {
            probe.counts.mounted++;
            options.signal!.addEventListener(
              "abort",
              () => probe.counts.aborted++,
            );
            const mounted = await original.mount(frame, options);
            return {
              ...mounted,
              subscribe(listener) {
                probe.emit = listener;
                const stop = mounted.subscribe(listener);
                return () => {
                  probe.counts.unsubscribed++;
                  stop();
                };
              },
              dispose() {
                probe.counts.disposed++;
                mounted.dispose();
              },
            };
          },
        };
        host.props.onPickEnd = (event) => {
          host.events.push({ name: "pick-end", value: event });
          throw probe.original;
        };
        host.render();
      }, cross);
      await page.waitForFunction(() =>
        Boolean(window.viewerHarness.get("one").ref.current),
      );
      await page.evaluate(async (replacement) => {
        const host = window.viewerHarness.get("one"),
          probe = (window as unknown as ProbeWindow).teardown;
        await host.ref.current.startPick();
        probe.separator = document.querySelector<HTMLElement>(
          "[data-mokly-nav-resize]",
        )!;
        probe.value = probe.separator.getAttribute("aria-valuenow");
        if (replacement === "source")
          host.props = {
            ...host.props,
            catalogue: structuredClone(host.props.catalogue),
          } as MoklyViewerProps;
        else host.props.frameAdapter = { ...host.props.frameAdapter! };
        host.render();
      }, replacement);
      await expect(page.locator(".mokly-viewer")).toHaveCount(0);
      const result = await page.evaluate(() => {
        const probe = (window as unknown as ProbeWindow).teardown,
          host = window.viewerHarness.get("one");
        const before = host.events.length;
        probe.emit({ type: "hover", key: null, boxes: [] });
        probe.emit({ type: "pick-end", reason: "escape" });
        probe.separator!.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
        return {
          counts: probe.counts,
          original: probe.caught.includes(probe.original),
          later: host.events.slice(before),
          value: probe.separator!.getAttribute("aria-valuenow"),
          before: probe.value,
          observers: [...probe.resize.values()]
            .flatMap((elements) => [...elements])
            .filter(
              (element) =>
                element.matches(".mokly-viewer") ||
                element.closest(".mokly-viewer"),
            ).length,
          ends: host.events
            .filter((event) => event.name === "pick-end")
            .map((event) => event.value),
          failures: host.events.filter((event) => event.name === "error"),
        };
      });
      expect(result.counts.mounted).toBeGreaterThan(0);
      expect(result.counts).toEqual({
        mounted: result.counts.mounted,
        aborted: result.counts.mounted,
        disposed: result.counts.mounted,
        unsubscribed: result.counts.mounted,
      });
      expect(result).toMatchObject({
        original: true,
        later: [],
        value: result.before,
        observers: 0,
        ends: [{ reason: "source-change" }],
        failures: [],
      });
      expect(errors).toEqual(["Host pick-end failure"]);
    });
  }
}
