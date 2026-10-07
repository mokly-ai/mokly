import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { runReview } from "../../dist/review/run.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import { committedReviewRepository } from "../helpers/committed_repository.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "../helpers/fixture.js";

/** Build real Firna controls through a custom consumer-renderer boundary. */
export async function startLinkControlFixture() {
  const fixture = await createFixture(controlSource(), {
    extraConfig: `colorSchemes: ["light", "dark"], renderer: "renderer.tsx",
moduleResolution: { aliases: { "react-native": "react-native-web" }, conditions: ["react-native", "import", "module", "default"], loaders: { ".js": "jsx" }, mainFields: ["react-native", "module", "main"], resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".js", ".jsx", ".json"] },`,
  });
  try {
    await fs.promises.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      rendererSource,
    );
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const run = promisify(execFile);
    for (const args of [
      ["init", "-q", "--initial-branch=main"],
      ["config", "user.name", "Mokly Fixture"],
      ["config", "user.email", "fixture@example.invalid"],
      ["add", "-A"],
      ["commit", "-qm", "test: base styled controls"],
    ])
      await run("git", args, { cwd: fixture.root });
    await fs.promises.writeFile(
      fixture.entryPath,
      controlSource("Updated Home"),
    );
    const updated = await compileCatalogue(config);
    await writeCompilation(updated, config);
    await runReview(
      config,
      "HEAD",
      config.review.outDir,
      committedReviewRepository(config),
    );
    const server = await startCatalogueServer(config, {
      base: "HEAD",
      port: 0,
      generatedOutputs: updated.outputs,
    });
    return {
      fixture,
      reviewDir: config.review.outDir,
      url: server.url,
      async close() {
        await server.close();
        await removeFixture(fixture);
      },
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}

function controlSource(firstTitle = "Home"): string {
  return validEntrySource({ firstTitle, body: `<Controls />` }).replace(
    'import React from "react";',
    `import React from "react";
import { MockLink } from "@mokly/mokly";
import { Button } from "@firna/ui/button";
const noop = () => {};
function Controls() { return <>
<MockLink asChild to="details"><Button tone="primary" testID="continue" onPress={noop}>Continue</Button></MockLink>
<Button tone="primary" testID="reference" onPress={noop}>Continue</Button>
<MockLink asChild to="details"><Button block tone="primary" testID="block-continue" onPress={noop}>Continue</Button></MockLink>
<Button block tone="primary" testID="block-reference" onPress={noop}>Continue</Button>
<MockLink asChild to="details"><Button disabled testID="disabled" onPress={noop}>Disabled</Button></MockLink>
<MockLink asChild to="details"><Button busy testID="busy" onPress={noop}>Busy</Button></MockLink>
<MockLink asChild to="details"><Button testID="no-handler">No handler</Button></MockLink>
<MockLink asChild to="details"><button id="outline-reset" style={{outlineStyle:"none"}}>Focus me</button></MockLink>
<script>window.__consumerScriptRan = true;</script>
</>; }`,
  );
}

const rendererSource = `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRegistry } from "react-native";
import { SharedUiThemeProvider } from "@firna/ui/theme";
export default function render(input) {
const body = renderToStaticMarkup(<SharedUiThemeProvider>{input.node}</SharedUiThemeProvider>);
AppRegistry.registerComponent("fixture-styles", () => () => null);
const styles = renderToStaticMarkup(AppRegistry.getApplication("fixture-styles", {}).getStyleElement());
return '<!doctype html><html><head><meta charset="utf-8">'+styles+'</head><body>'+body+'</body></html>';
}`;
