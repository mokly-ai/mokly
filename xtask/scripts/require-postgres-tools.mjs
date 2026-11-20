import { spawnSync } from "node:child_process";

const tools = [
  "createdb",
  "dropdb",
  "initdb",
  "pg_isready",
  "postgres",
  "psql",
];
const missing = tools.filter((tool) => {
  const result = spawnSync(tool, ["--version"], { stdio: "ignore" });
  return result.error || result.status !== 0;
});
if (missing.length) {
  console.error(
    `[xtask/prerequisite] cloud-infrastructure requires PostgreSQL server tools on PATH: ${missing.join(", ")}.`,
  );
  console.error(
    "Install PostgreSQL 16 and add its bin directory to PATH. Debian: /usr/lib/postgresql/16/bin.",
  );
  process.exitCode = 1;
}
