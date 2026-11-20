import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/** The database the browser tests run the real API against. */
export const databaseUrl =
  process.env.MKC_TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost/mkc_test";

/**
 * Why the browser tests cannot run here, or `undefined` when they can. An
 * unreachable database is a skip with a printed reason, exactly as the Rust
 * integration tests treat it; a reachable one must pass every assertion.
 */
export function databaseSkipReason(): string | undefined {
  try {
    execFileSync("psql", [databaseUrl, "-c", "select 1"], {
      stdio: "ignore",
      timeout: 10_000,
    });
    return undefined;
  } catch {
    return `Postgres is unreachable at ${databaseUrl}; browser tests need the real API.`;
  }
}

/** A disposable schema URL whose lifetime matches one browser-suite run. */
export interface IsolatedDatabase {
  /** Base-database schema created for this run. */
  schema: string;
  /** Connection URL that selects only this schema. */
  url: string;
}

/** Create an empty schema and return a URL that selects it for every connection. */
export function createIsolatedDatabase(): IsolatedDatabase {
  const schema = `app_tests_${randomUUID().replaceAll("-", "")}`;
  execFileSync(
    "psql",
    [
      databaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE SCHEMA ${schema}`,
    ],
    { stdio: "ignore", timeout: 10_000 },
  );
  const url = new URL(databaseUrl);
  const existing = url.searchParams.get("options");
  url.searchParams.set(
    "options",
    [existing, `-csearch_path=${schema}`].filter(Boolean).join(" "),
  );
  return { schema, url: url.toString() };
}

/** Drop exactly the disposable browser-suite schema. */
export function dropIsolatedDatabase(database: IsolatedDatabase): void {
  execFileSync(
    "psql",
    [
      databaseUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP SCHEMA ${database.schema} CASCADE`,
    ],
    { stdio: "ignore", timeout: 10_000 },
  );
}
