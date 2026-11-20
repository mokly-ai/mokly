import { execFileSync } from "node:child_process";

const database =
  process.env.MKC_TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost/mkc_test";
const result = execFileSync(
  "psql",
  [database, "--no-psqlrc", "--tuples-only", "--command", "SELECT 1"],
  { encoding: "utf8" },
);
if (result.trim() !== "1")
  throw new Error("Postgres did not return the readiness query");
