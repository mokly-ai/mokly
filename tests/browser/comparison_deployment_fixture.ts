import fs from "node:fs/promises";
import path from "node:path";

import { platformPackage } from "../../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../../packages/mokly/src/runtime.mjs";
import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { runCaptured } from "../../scripts/verification/process.mjs";
import { createComparisonCatalogue } from "../helpers/comparison_catalogue.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** Build two real static deployments for old-tab checks. */
export async function comparisonDeployments(
  options: { changeGeneration?: boolean } = {},
) {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "comparison-deploy-",
    ),
  );
  let host: Awaited<ReturnType<typeof serveStaticFiles>> | undefined =
    undefined;
  ownBrowserCleanup(async () => {
    await host?.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const source = path.join(root, "source");
  await fs.mkdir(source);
  await createComparisonCatalogue(source);
  const viewer = path.join(source, ".context/viewer");
  await fs.cp(path.join(repositoryRoot, "packages/viewer/dist"), viewer, {
    recursive: true,
  });
  const runtime = systemRuntime();
  const binary = runtime.nativePackage(
    platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
  ).binary;
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  const indexes: { deploymentId: string; comparisonUrl: string | null }[] = [];
  for (const [offset, directory] of [site, next].entries()) {
    if (offset === 1 && options.changeGeneration)
      await fs.appendFile(
        path.join(source, "specs/screens/stable.screen.html"),
        "\n<p>New comparison content</p>\n",
      );
    if (offset === 1)
      await fs.appendFile(
        path.join(viewer, "shell.css"),
        "\n/* Next viewer deployment */\n",
      );
    const output = path.join(source, `.context/build-${offset}`);
    const result = await runCaptured(
      binary,
      [
        "build",
        "--out",
        output,
        "--base",
        "fixture-base",
        "--strict",
        "--sidecars",
        "1",
      ],
      {
        cwd: source,
        env: {
          ...process.env,
          MOKLY_VIEWER_DIST: viewer,
          MOKLY_PACKAGE_ROOT: path.join(repositoryRoot, "packages/mokly"),
          MOKLY_NODE_EXECUTABLE: process.execPath,
        },
      },
    );
    if (result.exitCode !== 0 || result.signal || result.interrupted)
      throw new Error(`Comparison deployment build failed: ${result.stderr}`);
    await fs.cp(output, directory, { recursive: true });
    indexes.push(
      JSON.parse(
        await fs.readFile(
          path.join(directory, "mokly-viewer/index.json"),
          "utf8",
        ),
      ),
    );
  }
  await fs.rm(source, { recursive: true });
  host = await serveStaticFiles(site);
  return {
    url: host.url,
    indexes,
    async replace() {
      await fs.rename(site, path.join(root, "previous"));
      await fs.rename(next, site);
    },
  };
}
