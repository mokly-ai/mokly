import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../command.mjs";
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
import { smokeConsumerPublish } from "../publish.mjs";
import { smokeViewer } from "../viewer.mjs";

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
  await initializeDerivedGit(root, "mockups");
  const nested = path.join(root, "nested/config/discovery");
  await fs.promises.mkdir(nested, { recursive: true });
  await runBin(root, ["build"], { cwd: nested });
  await runBin(root, ["check"]);
  const fragment = await fs.promises.readFile(
    path.join(root, "mockups/mokly-generated/screens/packed-home.desktop.html"),
    "utf8",
  );
  assert.match(fragment, /data-fixture="esm-desktop"/);
  assert.match(
    fragment,
    /href="\.\/packed-detail\.desktop\.html#packed-section"[^>]+data-mokly-link="packed-detail#packed-section"/,
  );
  const coLocated = await fs.promises.readFile(
    path.join(root, "mockups/mokly-generated/screens/packed-card.desktop.html"),
    "utf8",
  );
  assert.match(coLocated, /data-packed-card=""/);
  const packedManifest = JSON.parse(
    await fs.promises.readFile(
      path.join(root, "mockups/mokly-generated/mokly-manifest.json"),
      "utf8",
    ),
  );
  assert.equal(
    packedManifest.entries.find((entry) => entry.id === "packed-card")
      ?.sourcePath,
    "src/components/card/card.mockup.tsx",
  );
  assert.ok(
    packedManifest.sourceFiles.includes("src/components/card/card.tsx"),
  );
  await smokeServer(root);
  await runCommand("npx", ["--no-install", "mokly", "--help"], {
    cwd: root,
  });

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
    "view/screens/packed-home.html",
  ]);
  assert.equal(
    exported.screens.find((screen) => screen.id === "packed-home")?.state,
    "changed",
  );
  await smokeViewer(root);
  await smokeRegisteredComponents(context, root);
  await smokeConsumerPublish(context, root);
}
