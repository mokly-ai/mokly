import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "./command.mjs";
import { smokeRegisteredComponents } from "./components.mjs";
import { consumerPackage } from "./consumer_package.mjs";
import { inspectConsumerExport } from "./export.mjs";
import {
  copyFixture,
  initializeGit,
  installConsumer,
  runBin,
  smokeServer,
} from "./fixture.mjs";
import { smokeConsumerPublish } from "./publish.mjs";
import { smokeViewer } from "./viewer.mjs";
import { smokeExternalWatch } from "./watch.mjs";

export async function smokeEsmConsumer(context) {
  const root = path.join(context.workingRoot, "esm-consumer");
  await copyFixture(path.join(context.fixturesRoot, "esm"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("packed-esm-consumer", context, true),
  );
  await runCommand(
    "npm",
    [
      "audit",
      "--audit-level=low",
      "--omit=dev",
      "--include=prod",
      "--include=optional",
      "--include=peer",
    ],
    { cwd: root },
  );
  await runCommand("node", ["verify-api.mjs"], { cwd: root });
  const help = await runBin(root, ["--help"]);
  assert.match(help.stdout, /mokly build/);
  const version = await runBin(root, ["--version"]);
  assert.equal(version.stdout.trim(), context.packageVersion);
  const nested = path.join(root, "nested/config/discovery");
  await fs.promises.mkdir(nested, { recursive: true });
  await runBin(root, ["build"], { cwd: nested });
  await runBin(root, ["check"]);
  const fragment = await fs.promises.readFile(
    path.join(root, "mockups/screens/home.desktop.html"),
    "utf8",
  );
  assert.match(fragment, /data-fixture="esm-desktop"/);
  assert.match(
    fragment,
    /href="\.\/detail\.desktop\.html#packed-section"[^>]+data-mokly-link="packed-detail#packed-section"/,
  );
  await smokeServer(root);
  await runCommand("npx", ["--no-install", "mokly", "--help"], {
    cwd: root,
  });

  await initializeGit(root);
  const entryPath = path.join(root, "entries/catalogue.mockup.tsx");
  const entry = await fs.promises.readFile(entryPath, "utf8");
  await fs.promises.writeFile(
    entryPath,
    entry.replaceAll("Packed home", "Updated packed home"),
  );
  await runBin(root, ["build"]);
  let review;
  await smokeServer(root, ["--base", "HEAD"], async (url) => {
    const response = await fetch(`${url}/__mokly/diffs/review.json`);
    assert.equal(response.status, 200);
    review = await response.json();
  });
  assert.equal(
    review.screens.find((screen) => screen.id === "packed-home")?.state,
    "changed",
  );
  await runBin(root, ["export", "--out", "published", "--base", "HEAD"], {
    cwd: nested,
  });
  const exported = await inspectConsumerExport(root, "published", "HEAD", [
    "id/packed-home/index.html",
  ]);
  assert.equal(
    exported.screens.find((screen) => screen.id === "packed-home")?.state,
    "changed",
  );
  await smokeViewer(root);
  await smokeRegisteredComponents(context, root);
  await smokeConsumerPublish(context, root);
}

export async function smokeNodeNextConsumer(context) {
  const root = path.join(context.workingRoot, "nodenext-consumer");
  await copyFixture(path.join(context.fixturesRoot, "nodenext"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("packed-nodenext-consumer", context, true),
  );
  await runCommand(
    path.join(root, "node_modules/.bin/tsc"),
    ["--project", "tsconfig.json"],
    { cwd: root },
  );
  await runCommand(
    "node",
    ["--input-type=module", "--eval", 'await import("@mokly/mokly")'],
    { cwd: root },
  );
}

export async function smokeCleanCacheExecution(context) {
  const root = path.join(context.workingRoot, "npx-consumer");
  await copyFixture(path.join(context.fixturesRoot, "esm"), root);
  const packageJson = consumerPackage(
    "clean-cache-npx-consumer",
    context,
    false,
  );
  await fs.promises.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await runCommand(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  assert.equal(
    fs.existsSync(path.join(root, "node_modules/@mokly/mokly")),
    false,
  );
  const cache = path.join(context.workingRoot, "empty-npx-cache");
  const packageSpec = `file:${context.archivePath}`;
  const npx = [
    "exec",
    "--yes",
    "--cache",
    cache,
    "--package",
    packageSpec,
    "--package",
    `file:${context.viewerArchivePath}`,
    "--",
    "mokly",
  ];
  await runCommand("npm", [...npx, "build"], { cwd: root });
  await runCommand("npm", [...npx, "check"], { cwd: root });
  assert.equal(
    fs.existsSync(path.join(root, "mockups/mokly-manifest.json")),
    true,
  );
  await fs.promises.rename(
    path.join(root, "mokly.config.ts"),
    path.join(root, "custom.config.ts"),
  );
  await initializeGit(root);
  await runCommand("git", ["branch", "export-baseline"], { cwd: root });
  const exportArgs = npx.map((arg) =>
    arg === cache ? path.join(context.workingRoot, "empty-export-cache") : arg,
  );
  await runCommand(
    "npm",
    [
      ...exportArgs,
      "export",
      "--config",
      "custom.config.ts",
      "--out",
      "published",
      "--base",
      "export-baseline",
    ],
    { cwd: root },
  );
  await inspectConsumerExport(root, "published", "export-baseline");
  assert.equal(
    fs.existsSync(path.join(root, "node_modules/@mokly/mokly")),
    false,
  );
}

export async function smokeAccountingFixture(context) {
  const root = path.join(context.workingRoot, "accounting-consumer");
  await copyFixture(path.join(context.fixturesRoot, "accounting"), root);
  const packageJson = consumerPackage(
    "accounting-shaped-consumer",
    context,
    true,
  );
  packageJson.workspaces = ["packages/*"];
  packageJson.dependencies["@firna/ui"] = "file:packages/firna-ui";
  packageJson.dependencies["react-native-web"] =
    "file:packages/react-native-web";
  await installConsumer(root, context.archivePath, packageJson);
  await runBin(root, ["build"]);
  await runBin(root, ["check"]);
  const appFragment = await fs.promises.readFile(
    path.join(root, "docs/mockups/app/dashboard.desktop.html"),
    "utf8",
  );
  const campaignFragment = await fs.promises.readFile(
    path.join(root, "docs/mockups/marketing/campaign.desktop.html"),
    "utf8",
  );
  assert.match(appFragment, /data-accounting-renderer="desktop"/);
  assert.match(appFragment, /data-theme="fixture-theme"/);
  assert.match(
    appFragment,
    /<a[^>]*class="fixture-button"[^>]*data-mokly-link="accounting-campaign"/,
  );
  assert.doesNotMatch(appFragment, /data-mokly-link-child-/);
  assert.match(appFragment, /href="\.\.\/app\.css"/);
  assert.match(campaignFragment, /href="\.\.\/marketing\.css"/);
  assert.equal(
    fs.existsSync(path.join(root, "docs/mockups/archive/legacy-notice.html")),
    true,
  );
  const pageManifest = JSON.parse(
    await fs.promises.readFile(
      path.join(root, "docs/mockups/mokly-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(pageManifest.schemaVersion, 5);
  assert.equal("legacyPages" in pageManifest, false);
  assert.ok(
    pageManifest.entries.some(
      (entry) => entry.id === "accounting-notice" && entry.kind === "page",
    ),
  );
  assert.ok(
    pageManifest.sourceFiles.some((file) =>
      file.endsWith("legacy/components.tsx"),
    ),
  );
  await smokeServer(root);
  await smokeExternalWatch(root);

  await initializeGit(root);
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
    "view/archive/legacy-notice.html",
    "static/app/dashboard.desktop.html",
  ]);
  await smokeRegisteredComponents(context, root, true);
}

export async function smokeJunoFixture(context) {
  const root = path.join(context.workingRoot, "juno-consumer");
  await copyFixture(path.join(context.fixturesRoot, "juno"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("juno-shaped-consumer", context, true),
  );
  const config = ["--config", "tools/mokly.config.ts"];
  await runBin(root, ["build", ...config]);
  await runBin(root, ["check", ...config]);
  const fragment = await fs.promises.readFile(
    path.join(root, "site/mockups/workspace/overview.mobile.html"),
    "utf8",
  );
  assert.match(fragment, /data-juno-layout="compact"/);
  assert.match(fragment, /href="\.\.\/juno\.css"/);
  await smokeServer(root, config);
  await initializeGit(root);
  await runBin(root, [
    "export",
    ...config,
    "--out",
    "published",
    "--base",
    "HEAD",
  ]);
  await inspectConsumerExport(root, "tools/published", "HEAD", [
    "view/workspace/overview.html",
  ]);
}
