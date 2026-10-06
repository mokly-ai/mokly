import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
  type TestFixture,
} from "../helpers/fixture.js";

let fixture: TestFixture;
let server: RunningServer;

test.beforeAll(async () => {
  fixture = await createFixture(
    validEntrySource({
      body: `<label>Choice<select aria-label="Choice" defaultValue="first"><option value="first">First</option><option value="second">Second</option></select></label><label>Enabled<input aria-label="Enabled" type="checkbox" /></label><details><summary>More</summary><p>Extra content</p></details>`,
    }),
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  server = await startCatalogueServer(config, { base: "HEAD", port: 0 });
  fixture.beforeRemove(() => server.close());
});

test.afterAll(async () => {
  if (fixture) await removeFixture(fixture);
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: native fields and disclosures work in sandboxed frames`, async ({
    page,
  }) => {
    await page.goto(`${server.url}/view/home/`);
    const iframe = page.locator(`.mbk-frame-${viewport} iframe`);
    expect((await iframe.getAttribute("sandbox"))?.split(/\s+/u)).not.toContain(
      "allow-scripts",
    );
    const frame = iframe.contentFrame();
    await frame
      .getByRole("combobox", { name: "Choice" })
      .selectOption("second");
    await expect(frame.getByRole("combobox", { name: "Choice" })).toHaveValue(
      "second",
    );
    const checkbox = frame.getByRole("checkbox", { name: "Enabled" });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await expect(
      frame.getByText("Extra content", { exact: true }),
    ).toBeHidden();
    await frame.locator("summary").click();
    await expect(
      frame.getByText("Extra content", { exact: true }),
    ).toBeVisible();
    await frame.locator("summary").click();
    await expect(frame.locator("details[open]")).toHaveCount(0);
    await expect(frame.locator("script")).toHaveCount(1);
    await expect(frame.locator("script")).toHaveAttribute(
      "src",
      "/__mokly/client/inspector.js",
    );
  });
