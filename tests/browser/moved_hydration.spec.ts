import { test } from "@playwright/test";

import {
  startMovedHost,
  type MovedChangesHost,
} from "./moved_changes_fixture.js";
import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

/** Every moved, pure-moved, and removed route of the moved catalogue. */
const ROUTES = [
  "account/billing/invoice",
  "account/billing/invoice/overdue",
  "account/billing/receipt",
  "account/billing/payment-terms",
  "billing/invoice/paid",
  "ui/action",
  "ui/action/primary",
  "ui/action/ghost",
  "ui/action/iconic",
  "components/action/secondary",
  "ui/icon/arrow",
];
const KINDS = ["serve", "export"] as const;

let bundle: string;
const hosts = new Map<(typeof KINDS)[number], MovedChangesHost>();

test.beforeAll(async () => {
  test.setTimeout(360_000);
  bundle = await buildDevelopmentBundle();
  for (const kind of KINDS) hosts.set(kind, await startMovedHost(kind));
});

test.afterAll(async () => {
  for (const host of hosts.values()) await host.close();
});

for (const kind of KINDS)
  for (const route of ROUTES)
    test(`${kind}: development React hydrates moved route ${route} cleanly`, async ({
      page,
    }) => {
      const errors = captureBrowserErrors(page);
      await installDevelopmentBundle(page, bundle);
      await hosts.get(kind)!.open(page, route);
      await expectCleanHydration(page, errors, route);
    });
