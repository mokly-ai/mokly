import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { smokeRegisteredComponents } from "../components.mjs";
import { consumerPackage } from "../consumer_package.mjs";
import { inspectConsumerExport } from "../export.mjs";
import {
  copyFixture,
  initializeDerivedGit,
  installConsumer,
  runBin,
  smokeServer,
} from "../fixture.mjs";
import { smokeExternalWatch } from "../watch.mjs";

export async function smokeThemedConsumer(context) {
  const root = path.join(context.workingRoot, "themed-consumer");
  await copyFixture(path.join(context.fixturesRoot, "themed"), root);
  const packageJson = consumerPackage("themed-consumer", context, true);
  packageJson.workspaces = ["packages/*"];
  packageJson.dependencies["@firna/ui"] = "file:packages/firna-ui";
  packageJson.dependencies["react-native-web"] =
    "file:packages/react-native-web";
  await installConsumer(root, context.archivePath, packageJson);
  await initializeDerivedGit(root, "docs/mockups");
  await runBin(root, ["build"]);
  await runBin(root, ["check"]);
  const appFragment = await fs.promises.readFile(
    path.join(root, "docs/mockups/screens/themed-dashboard.desktop.html"),
    "utf8",
  );
  const campaignFragment = await fs.promises.readFile(
    path.join(root, "docs/mockups/screens/themed-campaign.desktop.html"),
    "utf8",
  );
  assert.match(appFragment, /data-themed-renderer="desktop"/);
  assert.match(appFragment, /data-theme="fixture-theme"/);
  assert.match(
    appFragment,
    /<a[^>]*class="fixture-button"[^>]*data-mokly-link="themed-campaign"/,
  );
  assert.doesNotMatch(appFragment, /data-mokly-link-child-/);
  assert.match(appFragment, /href="\.\.\/app\.css"/);
  assert.match(campaignFragment, /href="\.\.\/marketing\.css"/);
  assert.equal(
    fs.existsSync(path.join(root, "docs/mockups/pages/themed-notice.html")),
    true,
  );
  const pageManifest = JSON.parse(
    await fs.promises.readFile(
      path.join(root, "docs/mockups/mokly-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(pageManifest.schemaVersion, 7);
  assert.ok(
    pageManifest.entries.some(
      (entry) => entry.id === "themed-notice" && entry.kind === "page",
    ),
  );
  assert.ok(
    pageManifest.sourceFiles.some((file) =>
      file.endsWith("legacy/components.tsx"),
    ),
  );
  await smokeServer(root);
  await smokeExternalWatch(root);

  await fs.promises.writeFile(
    path.join(root, "shared/tokens.ts"),
    'export const accent = "#6b4eff";\n',
  );
  await runBin(root, ["build"]);
  let review;
  await smokeServer(root, ["--base", "HEAD"], async (url) => {
    const response = await fetch(`${url}/__mokly/diffs/review.json`);
    assert.equal(response.status, 200);
    review = await response.json();
  });
  assert.deepEqual(review.sharedImpact, ["shared/tokens.ts"]);
  assert.ok(review.screens.every((screen) => screen.sharedImpact.length === 1));
  await runBin(root, ["export", "--out", "published"]);
  await inspectConsumerExport(root, "published", "HEAD", [
    "view/pages/themed-notice.html",
    "static/screens/themed-dashboard.desktop.html",
  ]);
  await smokeRegisteredComponents(context, root, true);
}
