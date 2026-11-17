import {
  expectHandoffSignsIn,
  expectMissingTokenRecovery,
  expectUsedByTheApp,
} from "./desktop-handoff-cases";
import { test } from "./harness";

test("a link the desktop app requested waits for the reader's choice", async ({
  page,
  request,
}) => {
  await expectHandoffSignsIn(page, request);
});

test("a link the desktop app exchanged first reports it was used", async ({
  page,
  request,
}) => {
  await expectUsedByTheApp(page, request);
});

test("a desktop link without its token is not valid", async ({ page }) => {
  await expectMissingTokenRecovery(page);
});
