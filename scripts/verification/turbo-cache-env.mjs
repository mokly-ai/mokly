import fs from "node:fs/promises";

const token = process.env.CACHE_TOKEN ?? "";
const signature = process.env.CACHE_SIGNATURE_KEY ?? "";
const team = process.env.CACHE_TEAM ?? "";
const entries = ["TURBO_CACHE=local:rw"];

if (token && signature) {
  entries[0] = "TURBO_CACHE=local:rw,remote:rw";
  entries.push(`TURBO_TOKEN=${token}`);
  entries.push(`TURBO_REMOTE_CACHE_SIGNATURE_KEY=${signature}`);
  if (team) entries.push(`TURBO_TEAM=${team}`);
}

await fs.appendFile(process.env.GITHUB_ENV, `${entries.join("\n")}\n`);
