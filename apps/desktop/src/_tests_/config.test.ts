import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { contentSecurityPolicy, readConfiguration } from "../config.js";

const config = {
  apiOrigin: "https://api.mokly.example",
  appOrigin: "https://mokly.example",
  catalogueBaseDomain: "catalogue.example",
  revision: "a".repeat(40),
};
const environment = {
  MKC_DESKTOP_BUILD_CONFIG: "/dev/config",
  MKC_DESKTOP_DIST: "/dev/export",
  MKC_DESKTOP_CATALOGUE_SOURCE: "http://*.localhost:8082",
};

test("packaged configuration ignores every environment override", () => {
  const read: string[] = [];
  const result = readConfiguration(
    {
      resolve,
      read: (path) => {
        read.push(path);
        return JSON.stringify(config);
      },
    },
    { packaged: true, root: "/app", environment },
  );
  assert.deepEqual(read, ["/app/bundle/build-config.json"]);
  assert.equal(result.directory, "/app/bundle/web");
  assert.equal(result.catalogueSource, "https://*.catalogue.example");
});

test("development permits only the local catalogue wildcard and explicit bundle paths", () => {
  const result = readConfiguration(
    {
      resolve,
      read: (path) => {
        assert.equal(path, "/dev/config");
        return JSON.stringify(config);
      },
    },
    { packaged: false, root: "/app", environment },
  );
  assert.equal(result.directory, "/dev/export");
  assert.equal(result.catalogueSource, "http://*.localhost:8082");
  for (const invalid of [
    "*",
    "http://evil.example:80",
    "http://*.localhost:65536",
    "http://*.localhost:80; script-src *",
  ]) {
    assert.throws(() =>
      readConfiguration(
        { resolve, read: () => JSON.stringify(config) },
        {
          packaged: false,
          root: "/app",
          environment: {
            ...environment,
            MKC_DESKTOP_CATALOGUE_SOURCE: invalid,
          },
        },
      ),
    );
  }
  assert.throws(() =>
    readConfiguration(
      { resolve, read: () => "{}" },
      { packaged: true, root: "/app", environment: {} },
    ),
  );
});

test("production CSP matches the app server, while development changes only the catalogue source", () => {
  const expected =
    "default-src 'self'; frame-src 'self' https://mokly.example https://api.mokly.example https://*.catalogue.example; connect-src 'self' https://mokly.example https://api.mokly.example https://*.catalogue.example; img-src 'self' data: https://*.catalogue.example; font-src 'self' https://*.catalogue.example; style-src 'self' 'unsafe-inline' https://*.catalogue.example; frame-ancestors 'none'";
  assert.equal(
    contentSecurityPolicy(config, "https://*.catalogue.example"),
    expected,
  );
  assert.equal(
    contentSecurityPolicy(config, environment.MKC_DESKTOP_CATALOGUE_SOURCE),
    expected.replaceAll(
      "https://*.catalogue.example",
      "http://*.localhost:8082",
    ),
  );
});
