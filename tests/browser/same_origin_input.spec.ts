import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import {
  crossOriginFixture,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";
import { mountLocalFrame } from "./frame_adapter_local_fixture.js";

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;
test.beforeAll(async () => {
  fixture = await crossOriginFixture({
    body: '<pane.Component moklyInstance="linked"><MockLink to="action">Open Action</MockLink></pane.Component>',
    paneRender:
      "(props) => <section style={{padding:12}}>{props.children}</section>",
  });
});
test.afterAll(async () => fixture?.close());

test("a local pick consumes a link before its click callback ends picking", async ({
  page,
}) => {
  await mountLocalFrame(page, fixture);
  // Direct adapter calls arrange a pick and observe its native input event.
  const evidence = await page.evaluateHandle(
    async (key) => {
      const state = window as unknown as FrameTestWindow;
      const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
      const evidence: { click: MouseEvent | null; bubbled: number } = {
        click: null,
        bubbled: 0,
      };
      frame.contentWindow!.addEventListener(
        "click",
        (event) => {
          evidence.click = event;
        },
        true,
      );
      frame.contentDocument!.addEventListener("click", () => {
        evidence.bubbled++;
      });
      state.mounted.subscribe((event) => {
        if (event.type === "click") void state.mounted.highlight([], "off");
      });
      await state.mounted.highlight([key], "pick");
      state.frameEvents = [];
      return evidence;
    },
    fixture.usage.instances.find(({ id }) => id === "linked")!.key,
  );
  try {
    await page
      .frameLocator("#frame")
      .getByRole("link", { name: "Open Action" })
      .click();
    expect(
      await evidence.evaluate(({ click, bubbled }) => ({
        prevented: click?.defaultPrevented,
        bubbled,
      })),
    ).toEqual({ prevented: true, bubbled: 0 });
    expect(
      await page.evaluate(() =>
        (window as unknown as FrameTestWindow).frameEvents
          .filter(({ type }) => type === "click" || type === "navigation")
          .map(({ type }) => type),
      ),
    ).toEqual(["click"]);
    await expect(
      page.frameLocator("#frame").getByRole("link", { name: "Open Action" }),
    ).toBeVisible();
  } finally {
    await evidence.dispose();
  }
});

test("local listener errors reach the host unchanged and later listeners receive the consumed pick", async ({
  page,
}) => {
  await mountLocalFrame(page, fixture);
  // The host installs a throwing listener and records the browser's error object.
  const evidence = await page.evaluateHandle(
    async (key) => {
      const state = window as unknown as FrameTestWindow;
      const failure = new Error("Local click listener failed");
      const evidence: {
        errors: unknown[];
        click: MouseEvent | null;
        delivered: string[];
      } = {
        errors: [],
        click: null,
        delivered: [],
      };
      window.addEventListener("error", (event) => {
        evidence.errors.push(event.error);
        event.preventDefault();
      });
      const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
      frame.contentWindow!.addEventListener(
        "click",
        (event) => {
          evidence.click = event;
        },
        true,
      );
      state.unsubscribe();
      state.mounted.subscribe((event) => {
        if (event.type === "click") {
          evidence.delivered.push("throwing");
          throw failure;
        }
      });
      state.mounted.subscribe((event) => {
        state.frameEvents.push(event);
        if (event.type === "click") evidence.delivered.push("recording");
      });
      await state.mounted.highlight([key], "pick");
      state.frameEvents = [];
      return { evidence, failure };
    },
    fixture.usage.instances.find(({ id }) => id === "linked")!.key,
  );
  try {
    await page
      .frameLocator("#frame")
      .getByRole("link", { name: "Open Action" })
      .click();
    expect(
      await evidence.evaluate(({ evidence, failure }) => ({
        sameError:
          evidence.errors.length === 1 && evidence.errors[0] === failure,
        prevented: evidence.click?.defaultPrevented,
        delivered: evidence.delivered,
      })),
    ).toEqual({
      sameError: true,
      prevented: true,
      delivered: ["throwing", "recording"],
    });
    expect(
      await page.evaluate(() =>
        (window as unknown as FrameTestWindow).frameEvents
          .filter(
            ({ type }) =>
              type === "error" || type === "click" || type === "navigation",
          )
          .map(({ type }) => type),
      ),
    ).toEqual(["click"]);
  } finally {
    await evidence.dispose();
  }
});
