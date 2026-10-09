import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { serve } from "../dist/server/serve.js";
import { parseReviewResult } from "../packages/viewer/dist/data.js";
import { readCatalogue } from "../packages/viewer/dist/index.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { changedFixture } from "./helpers/changed_fixture.js";
import {
  ignoredLinksRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import {
  version,
  waitForChangedCount,
  waitForInitialChanges,
} from "./helpers/watched_catalogue.js";

for (const storage of ["blobs", "rebuild"] as const)
  test(
    `${storage} ignored inserted links agree in Browse, watch, selected, export and publication`,
    { timeout: 60_000 },
    async (t) => {
      const fixture = await changedFixture(
        t,
        linkSource,
        {
          extraConfig:
            'renderer:"renderer.tsx", stylesheets:[{match:"**",stylesheets:["base.css"]}],',
        },
        async (item) => {
          await prepareLinkFixture(item, ignoredLinksRenderer);
          await fs.writeFile(
            path.join(item.root, ".gitignore"),
            ".mokly-cache/\n.context/\n" +
              (storage === "rebuild" ? "mockups/mokly-generated/\n" : ""),
          );
          await fs.writeFile(
            item.configPath,
            (await fs.readFile(item.configPath, "utf8")).replace(
              'outDir: ".review"',
              storage === "rebuild"
                ? 'outDir: ".review", baselineBuild: [["node", "baseline.mjs"]]'
                : 'outDir: ".review"',
            ),
          );
          if (storage === "rebuild") {
            const baseline = await compileCatalogue(
              await loadConfig(item.root),
            );
            await fs.writeFile(
              path.join(item.root, "baseline-output.json"),
              JSON.stringify([...baseline.outputs]),
            );
            await fs.writeFile(
              path.join(item.root, "baseline.mjs"),
              `import fs from "node:fs/promises";
import path from "node:path";
for (const [route, content] of JSON.parse(await fs.readFile("baseline-output.json", "utf8"))) {
  const target = path.join("mockups", "mokly-generated", route);
  await fs.mkdir(path.dirname(target), {recursive:true});
  await fs.writeFile(target, content);
}`,
            );
          }
        },
      );
      let config = fixture.config;
      const running = await serve(config, {
        base: "main",
        port: 0,
        watch: true,
      });
      fixture.beforeRemove(() => running.close());
      const initial = await waitForInitialChanges(running.url);
      const beforeCatalogue = readCatalogue(
        await (
          await fetch(`${running.url}/mokly-viewer/catalogue.json`)
        ).json(),
      );
      assert.ok(
        beforeCatalogue.screens.every(
          (screen) =>
            screen.changes.status === "ready" && !screen.changes.included,
        ),
      );
      const css = ".action{color:blue}";
      await fs.writeFile(path.join(fixture.mockupsDir, "action.css"), css);
      await waitForChangedCount(running.url, version(initial), 2);
      config = await loadConfig(fixture.root);
      const compiled = await compileCatalogue(config);
      const repository = await prepareReviewRepository(config, "main");
      const fast = await compareReview(compiled, config, repository, "main");
      const complete = await compareReview(
        compiled,
        config,
        repository,
        "main",
        undefined,
        undefined,
        [],
        { useFastPath: false },
      );
      assert.deepEqual(fast.result, complete.result);
      const retained = renderReviewArtifact(fast);
      assert.doesNotMatch(
        retained.get("review.json") as string,
        /insertedStylesheets|data-mokly-component-stylesheet/,
      );
      assert.throws(
        () => renderReviewArtifact({ result: fast.result, files: fast.files }),
        /resource evidence is not reachable/,
      );

      assert.deepEqual(
        fast.result.changes.map((entry) => entry.after?.path),
        ["action", "action/default"],
      );
      assert.ok(
        fast.result.affectedConsumers.some(
          (entry) => entry.changedComponentId === "action",
        ),
      );
      const expected = fast.result.screens.find(
        (screen) => screen.path === "checkout",
      )!;
      const selectedResponse = await fetch(
        `${running.url}/mokly-viewer/diffs/review.json?path=checkout`,
      );
      assert.equal(
        selectedResponse.status,
        200,
        await selectedResponse.clone().text(),
      );
      const selected = parseReviewResult(await selectedResponse.json());
      assert.deepEqual(selected.screens, [expected]);
      const live = readCatalogue(
        await (
          await fetch(`${running.url}/mokly-viewer/catalogue.json`)
        ).json(),
      );
      const evidence = (catalogue: typeof live) =>
        catalogue.screens
          .find((screen) => screen.path === "checkout")!
          .views.map((view) => view.resourceEvidence);
      assert.deepEqual(
        evidence(live),
        expected.views.map((view) => ({ reasons: view.reasons })),
      );
      const preview = await fetch(
        `${running.url}/static/mokly-generated/checkout/index.mobile.html`,
      );
      assert.equal(preview.status, 200);
      assert.match(
        await preview.text(),
        /assets-->[\s\S]*action\.css[\s\S]*ignore:end:assets/,
      );
      assert.equal(
        await (await fetch(`${running.url}/static/action.css`)).text(),
        css,
      );
      await running.close();
      config = await loadConfig(fixture.root);
      const exported = await exportCatalogue(config, {
        outDir: path.join(fixture.root, ".context/site"),
        base: "main",
      });
      const published = path.join(fixture.root, ".context/published");
      await buildPreview(config, published, {
        includeChanges: true,
        base: "main",
      });
      for (const output of [exported.outDir, published]) {
        const catalogue = readCatalogue(
          JSON.parse(
            await fs.readFile(
              path.join(output, "mokly-viewer/catalogue.json"),
              "utf8",
            ),
          ),
        );
        assert.deepEqual(evidence(catalogue), evidence(live));
        assert.equal(
          await fs.readFile(path.join(output, "static/action.css"), "utf8"),
          css,
        );
      }
    },
  );
