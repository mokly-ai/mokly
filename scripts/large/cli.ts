import fs from "node:fs/promises";
import path from "node:path";

import { benchmark } from "./benchmark.js";
import { options } from "./options.js";
import { prepareFixture, preparedFixture } from "./setup.js";

try {
  const input = options(process.argv.slice(2));
  const repository = path.resolve(import.meta.dirname, "../..");
  if (input.mode === "generate") {
    await fs.mkdir(path.join(repository, ".context"), { recursive: true });
    const root = input.root
      ? path.resolve(input.root)
      : await fs.mkdtemp(path.join(repository, ".context/large-"));
    await fs.mkdir(root, { recursive: true });
    const fixture = await prepareFixture(
      repository,
      input.size,
      input.variant,
      input.toolchain,
      root,
    );
    process.stdout.write(JSON.stringify(fixture, null, 2) + "\n");
  } else {
    if (!input.root) throw new Error("benchmark needs --root from generate");
    const fixture = await preparedFixture(path.resolve(input.root));
    process.stdout.write(
      JSON.stringify(
        await benchmark(fixture, input.selected, input.sidecars),
        null,
        2,
      ) + "\n",
    );
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
