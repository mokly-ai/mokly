import type { Page } from "@playwright/test";

import { apiFailure, failWith } from "../api-responses";
import { failureShape } from "../fragment";
import { expect, test } from "../harness";

import { busyOnlyWrites, busyWrites } from "./busy-writes";
import { refusals } from "./refusals";
import { prepare } from "./subject";
import { writes } from "./undoable-writes";

/**
 * Hold the write that one press sends until the test has read its control,
 * then refuse it, so every write is read while it works and the subject stays
 * as it was for the next one.
 */
async function holdWrite(page: Page, url: string, method: string) {
  const arrived = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  const { status, body } = apiFailure("unavailable");
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    arrived.resolve();
    await answer.promise;
    return route.fulfill({ status, contentType: "application/json", body });
  });
  return { arrived: arrived.promise, refuse: () => answer.resolve() };
}

test("a write shows its wait on its own busy control and inserts nothing", async ({
  page,
}) => {
  const subject = await prepare(page, "busy");
  const walk = [
    ...writes.map((write) => {
      const busy = busyWrites[write.where];
      expect(busy, `${write.where}: its busy control is listed`).toBeDefined();
      return { ...write, ...busy };
    }),
    ...busyOnlyWrites.map((write) => ({ ...write, give: async () => {} })),
  ];
  for (const write of walk) {
    const where = write.where;
    await write.visit(page, subject);
    await write.give(page, subject);
    const held = await holdWrite(page, write.url, write.method);
    const control = page.getByTestId(write.control);
    await control.click();
    await held.arrived;

    // The pressed control carries the wait: its working word, the busy
    // spinner, and focus it keeps because it stays enabled.
    await expect(control, `${where}: the working word`).toHaveText(
      write.working,
    );
    await expect(control, `${where}: busy`).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(control, `${where}: still enabled`).toBeEnabled();
    // A screen reader hears the operation, and its name is said nowhere
    // else: the form inserts nothing beside the control.
    const name = write.operation(subject) + "…";
    await expect(
      page.getByRole("status").filter({ hasText: name }),
      `${where}: the operation is heard`,
    ).toHaveCount(1);
    await expect(page.getByText(name), `${where}: said once`).toHaveCount(1);

    held.refuse();
    await expect(control, `${where}: at rest again`).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.unrouteAll();
  }
});

test("an undone input takes its failure with it", async ({ page }) => {
  const subject = await prepare(page, "undo");

  for (const write of writes) {
    const where = write.where;
    await write.visit(page, subject);
    await failWith(page, write.url, write.method, "unavailable");
    await write.give(page, subject);

    const control = page.getByTestId(write.control);
    await expect(control, `${where}: the control can send`).toBeEnabled();
    await control.click();
    await expect(page.getByRole("alert"), `${where}: it failed`).toHaveCount(1);
    await expect(control, `${where}: it offers the way back`).toHaveText(
      "Try again",
    );

    // The reader takes the input back out. There is no longer an attempt for
    // the failure to describe, so nothing about it stays on screen.
    await write.undo(page, subject);
    if (write.settles === "resting") {
      await expect(control, `${where}: the label rests`).toHaveText(
        write.resting,
      );
      await expect(control, `${where}: it refuses a press`).toBeDisabled();
    } else {
      await expect(control, `${where}: there is nothing to press`).toHaveCount(
        0,
      );
    }
    await expect(page.getByRole("alert"), `${where}: no notice`).toHaveCount(0);
    await expect(
      page.locator(".fo-error-details"),
      `${where}: no details`,
    ).toHaveCount(0);
    await page.unroute(write.url);
  }
});

test("a refused write says why immediately above its own control", async ({
  page,
}) => {
  const subject = await prepare(page, "order");

  for (const refusal of refusals) {
    const where = refusal.where;
    await refusal.refuse(page, subject);
    // The write is in flight when the press returns, so the fragment is waited
    // for rather than read from whatever the document held at that moment.
    await expect(
      page.locator(".fo-write-failure").getByTestId(refusal.control),
      `${where}: the control is inside the fragment`,
    ).toBeVisible();

    await expect(
      page.getByTestId(refusal.control),
      `${where}: the control is the way back`,
    ).toHaveText(refusal.says);

    const shape = await failureShape(page, refusal.control);
    expect(shape.causeAbove, `${where}: the cause is above the control`).toBe(
      true,
    );
    if (refusal.referenced === false) {
      expect(shape.references, `${where}: nothing to reference`).toBe(0);
    } else {
      expect(shape.references, `${where}: one reference`).toBe(1);
      expect(
        shape.detailsBelow,
        `${where}: the reference is beneath the control`,
      ).toBe(true);
    }
    await page.unrouteAll();
  }
});

test("a refusal the reader must answer keeps the control's label", async ({
  page,
}) => {
  const subject = await prepare(page, "answer");

  // A cause the reader's own text produced is reported on that field, so the
  // control still names what it does: pressing it again would send the same
  // text and be refused the same way. Only a form keeps its control on screen,
  // so only a form can be asked what it says.
  const answerable = writes.flatMap((write) =>
    write.settles === "resting" && write.owns
      ? [{ ...write, resting: write.resting, says: write.owns }]
      : [],
  );
  expect(answerable.length, "every form that owns a field is listed").toBe(7);

  for (const write of answerable) {
    const where = write.where;
    await write.visit(page, subject);
    await failWith(page, write.url, write.method, "validation-failed");
    await write.give(page, subject);
    const control = page.getByTestId(write.control);
    await control.click();

    await expect(
      page.getByText(write.says),
      `${where}: the cause is on the field, once`,
    ).toHaveCount(1);
    await expect(control, `${where}: the control keeps its label`).toHaveText(
      write.resting,
    );
    await expect(
      page.locator(".fo-write-failure").getByRole("alert"),
      `${where}: the fragment says nothing a second time`,
    ).toHaveCount(0);
    await page.unrouteAll();
  }
});
