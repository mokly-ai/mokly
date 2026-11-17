import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "electron";
import { DESKTOP_ORIGIN } from "../origin.js";
import { installPermissions, permissionAllowed } from "../permissions.js";

type RequestHandler = NonNullable<
  Parameters<Session["setPermissionRequestHandler"]>[0]
>;
type CheckHandler = NonNullable<
  Parameters<Session["setPermissionCheckHandler"]>[0]
>;

const cases: {
  name: string;
  permission: Parameters<RequestHandler>[1];
  isMainFrame: boolean;
  address: string;
  allowed: boolean;
}[] = [
  {
    name: "main-frame desktop copy",
    permission: "clipboard-sanitized-write",
    isMainFrame: true,
    address: DESKTOP_ORIGIN,
    allowed: true,
  },
  {
    name: "catalogue frame copy",
    permission: "clipboard-sanitized-write",
    isMainFrame: false,
    address: "https://p-publication.catalogue.mokly.ai",
    allowed: false,
  },
  {
    name: "desktop subframe copy",
    permission: "clipboard-sanitized-write",
    isMainFrame: false,
    address: DESKTOP_ORIGIN,
    allowed: false,
  },
  {
    name: "main-frame clipboard read",
    permission: "clipboard-read",
    isMainFrame: true,
    address: DESKTOP_ORIGIN,
    allowed: false,
  },
  {
    name: "main-frame media request",
    permission: "media",
    isMainFrame: true,
    address: DESKTOP_ORIGIN,
    allowed: false,
  },
  {
    name: "main-frame notification request",
    permission: "notifications",
    isMainFrame: true,
    address: DESKTOP_ORIGIN,
    allowed: false,
  },
  {
    name: "public app origin copy",
    permission: "clipboard-sanitized-write",
    isMainFrame: true,
    address: "https://app.mokly.ai",
    allowed: false,
  },
  ...[
    "mokly-app://desktop.evil",
    "mokly-app://desktop:123",
    "mokly-app://user@desktop",
    "null",
    "",
  ].map((address) => ({
    name: `untrusted origin ${address}`,
    permission: "clipboard-sanitized-write" as const,
    isMainFrame: true,
    address,
    allowed: false,
  })),
];

test("the pure permission decision keeps clipboard writes within the desktop main frame", () => {
  for (const entry of cases)
    assert.equal(
      permissionAllowed(entry.permission, entry.isMainFrame, entry.address),
      entry.allowed,
      entry.name,
    );
  assert.equal(
    permissionAllowed(
      "clipboard-sanitized-write",
      true,
      DESKTOP_ORIGIN + "/org/project?viewport=mobile#selection",
    ),
    true,
  );
});

test("permission requests and checks allow only main-frame desktop clipboard writes", () => {
  let request: RequestHandler = () => assert.fail("missing request handler");
  let check: CheckHandler = () => assert.fail("missing check handler");
  installPermissions({
    setPermissionRequestHandler: (handler) => {
      assert.ok(handler);
      request = handler;
    },
    setPermissionCheckHandler: (handler) => {
      assert.ok(handler);
      check = handler;
    },
  });
  for (const entry of cases) {
    const details = {
      requestingUrl: entry.address,
      isMainFrame: entry.isMainFrame,
    };
    const answers: boolean[] = [];
    request(
      null!,
      entry.permission,
      (allowed) => answers.push(allowed),
      details,
    );
    assert.deepEqual(answers, [entry.allowed], entry.name);
    assert.equal(
      check(null, entry.permission, entry.address, details),
      entry.allowed,
      entry.name,
    );
  }
  assert.equal(
    check(null, "clipboard-sanitized-write", "https://app.mokly.ai", {
      requestingUrl: DESKTOP_ORIGIN,
      isMainFrame: true,
    }),
    false,
    "checks use the requesting origin rather than the loaded URL",
  );
});
