import { expect, test } from "@playwright/test";

import { followupFixture } from "./viewer_followup_fixture.js";

import type {} from "./viewer_harness.js";

interface PickProbe {
  waiting: boolean;
  release: () => void;
  outcome?: "resolved" | "rejected";
}
interface ProbeWindow extends Window {
  pickProbe: PickProbe;
}

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  for (const transition of ["viewport", "scheme", "variant"] as const) {
    for (const pending of [false, true]) {
      test(`${cross ? "postMessage" : "same-origin"} ${transition} ends ${pending ? "pending" : "active"} pick at replacement`, async ({
        page,
      }) => {
        await page.goto(fixture.host.url);
        await page.waitForFunction(() => Boolean(window.viewerHarness));
        await page.evaluate(
          ({ cross, transition, pending }) => {
            const host = window.viewerHarness.start("one", {
              cross,
              defaultSelection: {
                screenId: transition === "variant" ? "pane" : "home",
              },
            });
            const original = host.props.frameAdapter!;
            const probe: PickProbe = { waiting: false, release: () => {} };
            (window as unknown as ProbeWindow).pickProbe = probe;
            if (pending)
              host.props.frameAdapter = {
                async mount(frame, options) {
                  const mounted = await original.mount(frame, options);
                  return {
                    ...mounted,
                    async highlight(keys, mode) {
                      await mounted.highlight(keys, mode);
                      if (mode === "pick" && !probe.waiting) {
                        probe.waiting = true;
                        await new Promise<void>((resolve) => {
                          probe.release = resolve;
                        });
                      }
                    },
                  };
                },
              };
            host.render();
          },
          { cross, transition, pending },
        );
        await page.waitForFunction(() =>
          Boolean(window.viewerHarness.get("one").ref.current),
        );
        await page.evaluate((pending) => {
          const activation = window.viewerHarness
            .get("one")
            .ref.current.startPick()
            .then(
              () => {
                (window as unknown as ProbeWindow).pickProbe.outcome =
                  "resolved";
              },
              () => {
                (window as unknown as ProbeWindow).pickProbe.outcome =
                  "rejected";
              },
            );
          return pending ? undefined : activation;
        }, pending);
        if (pending)
          await page.waitForFunction(
            () => (window as unknown as ProbeWindow).pickProbe.waiting,
          );
        if (transition === "variant")
          await page
            .getByRole("combobox", { name: "Saved variant" })
            .selectOption("second");
        else
          await page.evaluate(
            (transition) =>
              window.viewerHarness
                .get("one")
                .ref.current.select(
                  transition === "viewport"
                    ? { viewport: "desktop" }
                    : { colorScheme: "dark" },
                ),
            transition,
          );
        if (pending) {
          await expect
            .poll(() =>
              page.evaluate(
                () => (window as unknown as ProbeWindow).pickProbe.outcome,
              ),
            )
            .toBe("rejected");
          await page.evaluate(() =>
            (window as unknown as ProbeWindow).pickProbe.release(),
          );
        }
        expect(
          await page.evaluate(() =>
            window.viewerHarness
              .get("one")
              .events.filter((event) => event.name.startsWith("pick")),
          ),
        ).toEqual(
          pending
            ? []
            : [
                { name: "pick-start", value: null },
                { name: "pick-end", value: { reason: "navigation" } },
              ],
        );
        await expect(
          page.locator("[data-mokly-label-layer] button"),
        ).toHaveCount(0);
        await page.evaluate(async () => {
          await window.viewerHarness.get("one").ref.current.startPick();
        });
        expect(
          await page.evaluate(() =>
            window.viewerHarness
              .get("one")
              .events.filter((event) => event.name === "pick-start"),
          ),
        ).toHaveLength(pending ? 1 : 2);
        await expect(
          page.locator("[data-mokly-label-layer] button").first(),
        ).toBeVisible();
        await page.evaluate(() => {
          window.viewerHarness.get("one").ref.current.cancelPick();
          window.viewerHarness.get("one").ref.current.cancelPick();
        });
        expect(
          await page.evaluate(() =>
            window.viewerHarness
              .get("one")
              .events.filter((event) => event.name === "pick-end")
              .map((event) => event.value),
          ),
        ).toEqual(
          pending
            ? [{ reason: "cancelled" }]
            : [{ reason: "navigation" }, { reason: "cancelled" }],
        );
      });
    }
  }
}
