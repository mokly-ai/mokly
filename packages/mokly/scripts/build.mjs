import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
await fs.mkdir(new URL("dist/", root), { recursive: true });
for (const file of ["version.mjs", "platform.mjs", "shim.mjs", "runtime.mjs"]) {
  await fs.copyFile(
    new URL(`src/${file}`, root),
    new URL(`dist/${file}`, root),
  );
}
