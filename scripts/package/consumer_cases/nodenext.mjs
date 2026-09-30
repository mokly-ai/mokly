import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../command.mjs";
import { consumerPackage } from "../consumer_package.mjs";
import { copyFixture, installConsumer } from "../fixture.mjs";
import { rendererContractSnippet } from "../renderer_contract.mjs";

export async function smokeNodeNextConsumer(context) {
  const root = path.join(context.workingRoot, "nodenext-consumer");
  await copyFixture(path.join(context.fixturesRoot, "nodenext"), root);
  await installConsumer(
    root,
    context.archivePath,
    consumerPackage("packed-nodenext-consumer", context, true),
  );
  const renderingContract = await fs.promises.readFile(
    path.join(context.repositoryRoot, "docs/protocol/mokly-rendering.md"),
    "utf8",
  );
  await fs.promises.writeFile(
    path.join(root, "renderer-contract.d.ts"),
    `${rendererContractSnippet(renderingContract)}\n`,
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
