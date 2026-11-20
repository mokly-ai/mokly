import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { currentDocumentPath } from "@mokly/viewer/data";

import { callbackLandings } from "../../../../apps/app/src/navigation/callback-input";
import { invitationAcceptancePath } from "../../../../apps/app/src/navigation/paths";
import { invitationEmail } from "../emails/invitation";
import {
  invitationContent,
  invitationIds,
  signInContent,
} from "../fixtures/emails";
import { publicationLink } from "../fixtures/publication-screens";
import { app, siteOrigin } from "../fixtures/site";

import { catalogueEntries } from "./catalogue-index";
import { entryDetailPath, indexPath, outputRoot } from "./catalogue-paths";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const mockupsRoot = path.resolve(sourceRoot, "..");
const repositoryRoot = path.resolve(mockupsRoot, "../..");
const siteFixture = path.join(sourceRoot, "fixtures", "site.ts");
const moklySubdomain = /https:\/\/(?:[a-z0-9-]+\.)+mokly\.ai/gi;

async function filesUnder(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function assertNoMoklySubdomain(file: string): Promise<void> {
  const source = await readFile(file, "utf8");
  assert.equal(
    source.match(moklySubdomain),
    null,
    `${path.relative(repositoryRoot, file)} contains a noncanonical mokly.ai host`,
  );
}

test("account entry and Share links use the shared site origin", () => {
  assert.equal(siteOrigin, "https://mokly.ai");
  assert.deepEqual(app, {
    signIn: siteOrigin + "/sign-in",
    signUp: siteOrigin + "/sign-up",
  });
  const screenLink = publicationLink({ screen: "home" });
  const catalogueLink = publicationLink({});
  assert.ok(screenLink.startsWith(siteOrigin + "/mokly-team/mokly-cloud/"));
  assert.ok(catalogueLink.startsWith(siteOrigin + "/mokly-team/mokly-cloud/"));
  assert.ok(screenLink.includes("catalogueScreen=home"));
  assert.ok(!screenLink.includes("/app/"));
});

test("email destinations match the application's canonical routes", async () => {
  const rustPaths = await readFile(
    path.join(repositoryRoot, "crates/mkc-domain/src/app_paths.rs"),
    "utf8",
  );
  const rustCallback = /pub const EMAIL_CALLBACK: &str = "([^"]+)"/.exec(
    rustPaths,
  )?.[1];
  assert.ok(rustCallback);

  const callback = new URL(signInContent.link);
  assert.equal(callback.origin, siteOrigin);
  assert.equal(callback.pathname, rustCallback);
  assert.equal(callback.pathname, callbackLandings.email.route);
  assert.equal(callback.hash, "#token=example-not-a-credential");

  const invitation = new URL(invitationContent.link);
  assert.equal(invitation.origin, siteOrigin);
  assert.equal(
    invitation.pathname,
    invitationAcceptancePath(invitationIds.workspace, invitationIds.member),
  );
  assert.equal(invitation.search, "");
});

test("the invitation names the workspace separately from Mokly", () => {
  assert.equal(
    invitationEmail.subject(invitationContent),
    "Join Mokly Team on Mokly",
  );
});

test("mockup sources keep the apex as the only mokly.ai origin", async () => {
  for (const file of await filesUnder(sourceRoot)) {
    if (file !== siteFixture) await assertNoMoklySubdomain(file);
  }
});

test("generated documents contain no mokly.ai subdomain", async () => {
  // Every document the build wrote, and the catalogue index and entry details
  // that carry each entry's metadata and component props.
  const documents = await filesUnder(
    path.resolve(outputRoot, currentDocumentPath("")),
  );
  for (const file of [
    ...documents.filter((document) => document.endsWith(".html")),
    path.resolve(outputRoot, indexPath),
    ...catalogueEntries().map((entry) =>
      path.resolve(outputRoot, entryDetailPath(entry.path)),
    ),
  ])
    await assertNoMoklySubdomain(file);
});
