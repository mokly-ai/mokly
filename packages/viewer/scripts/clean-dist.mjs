import fs from "node:fs/promises";
import path from "node:path";

// A fresh build never ships an output an earlier entry inventory left behind.
await fs.rm(path.resolve(import.meta.dirname, "../dist"), {
  force: true,
  recursive: true,
});
