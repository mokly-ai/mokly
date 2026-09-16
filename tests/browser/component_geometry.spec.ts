import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import type * as Geometry from "../../packages/viewer/dist/client/component_geometry.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "../helpers/fixture.js";

let fixture: TestFixture;
let server: RunningServer;
test.beforeAll(async () => {
  fixture = await createFixture(
    componentEntrySource({
      body: '<action.Component label="Clipped" moklyInstance="clip" /><action.Component label="Multiple" moklyInstance="multiple" disabled /><action.Component label="Invisible" moklyInstance="invisible" hidden />',
      actionRender:
        '(props) => props.hidden ? null : props.disabled ? <><span>First root</span> Text root <strong>Last root</strong></> : <div id="clip" style={{ width: 180, height: 90, overflow: "hidden" }}><button style={{ marginTop: 60, width: 160, height: 90 }}>{props.label}</button></div>',
    }),
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  server = await startCatalogueServer(config, { base: "main", port: 0 });
});
test.afterAll(async () => {
  await server?.close();
  if (fixture) await removeFixture(fixture);
});

test("component geometry clips nested overflow and preserves multiple roots and null instances", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeEnabled();
  const facts = await page.evaluate(async () => {
    const { authenticateRanges, rangeBounds } = (await import(
      `${location.origin}/__mokly/client/component_geometry.js`
    )) as typeof Geometry;
    const data = JSON.parse(
      document.querySelector("[data-workspace-data]")!.textContent!,
    );
    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-workspace-frame="mobile"]',
    )!;
    const view = data.views.find(
      (item: { viewport: string }) => item.viewport === "mobile",
    );
    const instances = view.usage.instances as {
      key: string;
      props: { label: readonly [string, string] };
    }[];
    const bounds = rangeBounds(
      frame,
      authenticateRanges(frame, view.path, view.usage)!,
      new Set(instances.map((item) => item.key)),
    );
    const boxes = (label: string) =>
      bounds.filter(
        (box: { key: string }) =>
          box.key ===
          instances.find((item) => item.props.label[1] === label)?.key,
      );
    return {
      clipped: boxes("Clipped"),
      multiple: boxes("Multiple"),
      hidden: boxes("Invisible"),
      bottom: frame
        .contentDocument!.getElementById("clip")!
        .getBoundingClientRect().bottom,
    };
  });
  expect(facts.clipped.length).toBeGreaterThan(0);
  expect(
    facts.clipped.every(
      (box: { y: number; height: number }) =>
        box.y + box.height <= facts.bottom,
    ),
  ).toBe(true);
  expect(facts.multiple.length).toBeGreaterThanOrEqual(3);
  expect(facts.hidden).toEqual([]);
});
