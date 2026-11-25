/** How `npm run dev:cloud` reads the database address from its setting. */
import assert from "node:assert/strict";
import test from "node:test";
import { inspect } from "node:util";

import { databaseEndpoint } from "./dev-settings.mjs";

test("reads the host and the default Postgres port from a URL without a port", () => {
  assert.deepEqual(databaseEndpoint("postgres://u:p@db.local/mkc_test"), {
    host: "db.local",
    port: 5432,
  });
});

test("gives an IPv6 host without brackets, so a TCP probe can reach it", () => {
  assert.deepEqual(databaseEndpoint("postgres://u:p@[::1]:5433/mkc_test"), {
    host: "::1",
    port: 5433,
  });
});

test("rejects a URL that cannot be read without printing its password", () => {
  assert.throws(
    () => databaseEndpoint("postgres://u:s3cret@localhost:99999/mkc_test"),
    (error) => {
      assert.equal(
        error.message,
        "MKC_DATABASE_URL is not a valid URL. Fix it, or unset it to use the local default.",
      );
      // Node prints every property of an uncaught error, `input` included.
      assert.equal(inspect(error).includes("s3cret"), false);
      return true;
    },
  );
});
