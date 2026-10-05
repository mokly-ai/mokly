import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
} from "./branch_hosts.js";
import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

const CONFIG =
  '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}';
const HOME = `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Home',description:'Home',dependencies:[],relatedDocs:[],mobile:<main><h1>Home</h1></main>,desktop:<main><h1>Home</h1></main>});`;

/** A screen whose render carries an inline script that marks its document. */
const WIDGET = `import {defineScreen} from '@mokly/mokly';
const view = <main><h1>Widget</h1><script dangerouslySetInnerHTML={{__html: "document.documentElement.dataset.previewScript = 'ran';"}} /></main>;
export default defineScreen({title:'Widget',description:'A widget with a script',dependencies:[],relatedDocs:[],mobile:view,desktop:view});`;

/** The branch deletes Widget, so its previous version still carries the script. */
function scriptedRemoval() {
  return branchCatalogue(
    { "specs/home.mockup.tsx": HOME, "specs/widget.mockup.tsx": WIDGET },
    CONFIG,
    async (fixture) => {
      await fs.rm(path.join(fixture.root, "specs/widget.mockup.tsx"));
    },
  );
}

const KINDS = ["serve", "export"] as const;
let bundle: string;
const hosts = new Map<(typeof KINDS)[number], BranchHost>();

test.beforeAll(async () => {
  test.setTimeout(360_000);
  bundle = await buildDevelopmentBundle();
  for (const kind of KINDS)
    hosts.set(kind, await startBranchHost(kind, scriptedRemoval));
});

test.afterAll(async () => {
  for (const host of hosts.values()) await host.close();
});

for (const kind of KINDS)
  test(`${kind}: a previous version's blocked script leaves hydration clean`, async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await installDevelopmentBundle(page, bundle);
    await hosts.get(kind)!.open(page, "widget");
    const frame = page.locator("iframe[data-mokly-preview-frame]").first();
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).toHaveAttribute("srcdoc", /<script>/u);
    await expect(
      page
        .frameLocator("iframe[data-mokly-preview-frame]")
        .first()
        .locator("h1"),
    ).toHaveText("Widget");
    expect(
      await frame.evaluate(
        (element) =>
          (element as HTMLIFrameElement).contentDocument?.documentElement
            .dataset["previewScript"] ?? "blocked",
      ),
    ).toBe("blocked");
    await expectCleanHydration(page, errors, "widget");
  });
