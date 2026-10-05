import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { consumerPackage } from "../consumer_package.mjs";
import { inspectConsumerExport } from "../export.mjs";
import {
  copyFixture,
  initializeDerivedGit,
  installConsumer,
  runBin,
  smokeServer,
} from "../fixture.mjs";

export async function smokeJunoFixture(context) {
  const root = path.join(context.workingRoot, "juno-consumer");
  await copyFixture(path.join(context.fixturesRoot, "juno"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("juno-shaped-consumer", context, true),
  );
  await initializeDerivedGit(root, "site/mockups");
  const config = ["--config", "tools/mokly.config.ts"];
  await runBin(root, ["build", ...config]);
  await runBin(root, ["check", ...config]);
  const fragment = await fs.promises.readFile(
    path.join(root, "site/mockups/workspace-overview/index.mobile.html"),
    "utf8",
  );
  assert.match(fragment, /data-juno-layout="compact"/);
  assert.match(fragment, /href="\.\.\/juno\.css"/);
  await smokeServer(root, config);
  await runBin(root, [
    "export",
    ...config,
    "--out",
    "published",
    "--base",
    "HEAD",
  ]);
  await inspectConsumerExport(root, "tools/published", "HEAD", [
    "view/workspace-overview/index.html",
  ]);
}
