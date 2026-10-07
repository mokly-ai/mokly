import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import { parseReviewResult } from "@mokly/viewer/data";
import { createCatalogue } from "@mokly/viewer/server";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { projectCatalogue } from "../dist/catalogue/projection.js";
import { exportCatalogue } from "../dist/export/run.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { readShellCatalogue } from "../packages/viewer/src/catalogue/reader.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import { pathFixture } from "./helpers/path_fixture.js";

function component(title: string, variants: string): string {
  return `import {defineComponent} from '@mokly/mokly';
export default defineComponent({title:'${title}',description:'A control',relatedDocs:[],propSchema:{kind:'object',properties:{label:{schema:{kind:'string'}}}},render:(props)=><button>{props.label}</button>,variants:[${variants}]});`;
}
const primary = "{slug:'primary',title:'Primary',props:{label:'Continue'}}";
const initial = "{slug:'default',title:'Default',props:{label:'Save'}}";

for (const boundary of ["reader", "Serve", "export"])
  test(`a removed component with its last variant moved passes ${boundary}`, async (t) => {
    const fixture = await pathFixture(
      {
        "specs/old.mockup.tsx": component("Old", primary),
        "specs/new.mockup.tsx": component("New", initial),
      },
      '{mockupsDir:"mockups",roots:[{dir:"specs"}],}',
    );
    t.after(() => fixture.remove());
    await fs.mkdir(path.join(fixture.root, "mockups"));
    const before = await fixture.compile();
    await writeCompilation(before, await fixture.config());
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", "-A");
    git("commit", "-qm", "test: component baseline");
    await fs.unlink(path.join(fixture.root, "specs/old.mockup.tsx"));
    await fixture.write(
      "specs/new.mockup.tsx",
      component(
        "New",
        `${initial},${primary.replace("slug:'primary'", "slug:'primary',movedFrom:'old/primary'")}`,
      ),
    );
    const config = await fixture.config();
    const after = await fixture.compile();
    await writeCompilation(after, config);
    const repository = componentGit(before);
    const review = parseReviewResult(
      (await compareReview(after, config, repository, "main")).result,
    );
    assert.deepEqual(
      review.components.find((e) => e.path === "old")?.variants,
      [],
    );
    assert.equal(
      review.components
        .find((e) => e.path === "new")
        ?.variants.find((e) => e.path === "new/primary")?.previousPath,
      "old/primary",
    );
    const changes = await computeCatalogueChanges(
      config,
      "main",
      repository,
      after.manifest,
    );
    if (boundary === "reader") {
      const model = projectCatalogue({
        catalogue: createCatalogue(after.manifest, changes.removedEntries),
        configPath: "mokly.config.ts",
        changesStatus: "ready",
        comparisonUrl: null,
        changedEntries: changes.changedEntries,
        evidence: changes.componentChanges,
        revision: { content: 0, evidence: 0 },
      });
      assert.deepEqual(readCatalogue(model), model);
      assert.deepEqual(readShellCatalogue(model), model);
      assert.deepEqual(
        model.removedEntries.map(({ entry }) => entry.path),
        ["old"],
      );
      const emptyCurrent = {
        ...model,
        components: model.components.filter((e) => !("variantOf" in e)),
        tree: [{ kind: "entry", path: "new" }],
      };
      assert.throws(() => readCatalogue(emptyCurrent), {
        detail: "component needs variants",
      });
      assert.throws(() => readShellCatalogue(emptyCurrent), {
        detail: "component needs variants",
      });
    } else if (boundary === "Serve") {
      const server = await startCatalogueServer(config, {
        base: "main",
        port: 0,
        componentRuntime: componentRuntime(after),
        componentChanges: changes.componentChanges!,
        changedEntries: changes.changedEntries,
      });
      try {
        for (const route of [
          "/",
          "/view/new/",
          "/view/new/default/",
          "/view/new/primary/",
          "/view/old/",
        ])
          assert.equal(
            (await fetch(`${server.url}${route}`)).status,
            200,
            route,
          );
        const model = readCatalogue(
          await (
            await fetch(`${server.url}/mokly-viewer/catalogue.json`)
          ).json(),
        );
        assert.deepEqual(
          model.removedEntries.map(({ entry }) => entry.path),
          ["old"],
        );
      } finally {
        await server.close();
      }
    } else {
      await exportCatalogue(config, { outDir: "site", base: "main" });
      const model = readCatalogue(
        JSON.parse(
          await fs.readFile(
            path.join(fixture.root, "site/mokly-viewer/catalogue.json"),
            "utf8",
          ),
        ),
      );
      assert.deepEqual(
        model.removedEntries.map(({ entry }) => entry.path),
        ["old"],
      );
      assert.equal(
        model.components.find((e) => e.path === "new/primary")?.previousPath,
        "old/primary",
      );
      assert.ok(
        (
          await fs.stat(path.join(fixture.root, "site/view/old/index.html"))
        ).isFile(),
      );
    }
  });
