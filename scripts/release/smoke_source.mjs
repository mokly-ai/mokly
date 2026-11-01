/**
 * The consumer module the release smoke runs against the installed viewer
 * archive. It names the public entries of the package and a few exports of
 * each, and the stylesheet of the UI package the viewer depends on; a root
 * test checks every name against the built packages.
 */
export const SMOKE_SOURCE = `
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MoklyViewer,
  readCatalogueIndex,
  readEntryDetail,
  resolveInstance,
} from "@mokly/viewer";
import {
  GENERATED_DIRECTORY,
  isEntryPath,
  validatePropSchema,
  viewHref,
} from "@mokly/viewer/data";
assert.equal(typeof MoklyViewer, "function");
assert.equal(typeof readCatalogueIndex, "function");
assert.equal(typeof readEntryDetail, "function");
assert.equal(typeof resolveInstance, "function");
assert.equal(typeof GENERATED_DIRECTORY, "string");
assert.equal(typeof isEntryPath, "function");
assert.equal(typeof validatePropSchema, "function");
assert.equal(typeof viewHref, "function");
assert.ok(fs.existsSync(new URL(import.meta.resolve("@mokly/viewer/browser"))));
assert.ok(fs.readFileSync(new URL(import.meta.resolve("@mokly/viewer/styles.css")), "utf8").length > 0);
assert.ok(fs.existsSync(new URL(import.meta.resolve("@mokly/ui/styles.css"))));
`;
