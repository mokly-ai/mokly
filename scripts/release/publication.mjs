import { runCommand } from "./command.mjs";
import { verifyRegistry } from "./registry_verifier.mjs";

/** Verify each package before the next package can become installable. */
export async function publishPackages(root, packages, dependencies = {}) {
  const verify = dependencies.verify ?? verifyRegistry;
  const execute = dependencies.execute ?? runCommand;
  for (const { archivePath, report } of packages) {
    const options = { localReport: report, repositoryRoot: root };
    const published = await verify({ ...options, mode: "guard" });
    if (!published)
      await execute(
        "npm",
        ["publish", archivePath, "--access", "public", "--ignore-scripts"],
        { cwd: root },
      );
    await verify({ ...options, mode: "verify", distTag: "latest" });
  }
}
