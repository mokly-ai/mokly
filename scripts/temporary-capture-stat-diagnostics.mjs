import sync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const fields = ["dev", "ino", "ctimeNs", "mtimeNs", "ctimeMs", "mtimeMs", "size"];
const describe = (stat) => Object.fromEntries(fields.filter((key) => key in stat).map((key) => [key, String(stat[key])]));

export async function diagnostics(root) {
  if (process.platform !== "win32") return;
  for (const file of [root, path.resolve("package.json")]) {
    const results = {};
    for (const bigint of [false, true]) {
      for (const method of ["stat", "lstat"]) {
        const key = `${method}-${bigint ? "bigint" : "number"}`;
        try { results[key] = describe(await fs[method](file, { bigint })); }
        catch (error) { results[key] = { error: error.code, message: error.message }; }
        try { results[key + "-sync"] = describe(sync[method + "Sync"](file, { bigint })); }
        catch (error) { results[key + "-sync"] = { error: error.code, message: error.message }; }
      }
    }
    let handle;
    try {
      handle = await fs.open(file, "r");
      results["fstat-bigint"] = describe(await handle.stat({ bigint: true }));
      results["fstat-number"] = describe(await handle.stat());
    } catch (error) {
      results.fstat = { error: error.code, message: error.message };
    } finally {
      await handle?.close();
    }
    console.log(JSON.stringify({ event: "stat-diagnostics", node: process.version, file, results }));
  }
}
