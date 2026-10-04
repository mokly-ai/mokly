import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { DocumentService } from "../dist/server/demand/service.js";

import { installedLinkedFixture } from "./helpers/installed_linked.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const mutation of ["edit", "delete", "syntax error"] as const) {
  test(`an installed import of linked repository source stays pinned after ${mutation} before first Live compilation`, async (t) => {
    const fixture = await installedLinkedFixture();
    t.after(() => fixture.remove());
    assert.equal((await fs.lstat(fixture.installed)).isSymbolicLink(), false);
    const accepted = await acceptedStyles(fixture.root);
    const documents = new DocumentService(accepted);
    fixture.beforeRemove(() => documents.close());
    const html = (await documents.read("screens/home.desktop.html")).html;
    assert.match(html, /accepted-linked-source/);
    assert.ok(
      accepted.interactiveSources!.files.some(
        ({ paths }) =>
          paths.includes("node_modules/linked-package/index.ts") &&
          paths.includes("packages/linked-package/index.ts"),
      ),
      "the accepted linked source already exists in the capture",
    );
    const target = path.join(fixture.linked, "index.ts");
    const source = await fs.readFile(target, "utf8");
    const installed = await fs.readFile(
      path.join(fixture.installed, "index.js"),
      "utf8",
    );
    if (mutation === "delete") await fs.rm(target);
    else
      await fs.writeFile(
        target,
        mutation === "edit"
          ? 'export const marker = "changed-linked-source";\n'
          : 'export const marker = "unterminated;\n',
      );

    const pinned = await compileLiveStyles(accepted);
    assert.match(pinned, /accepted-linked-source/);
    assert.doesNotMatch(pinned, /changed-linked-source/);
    assert.equal(
      await fs.readFile(path.join(fixture.installed, "index.js"), "utf8"),
      installed,
    );
    assert.equal(
      (await documents.read("screens/home.desktop.html")).html,
      html,
    );
    if (mutation === "edit") {
      const next = await acceptedStyles(fixture.root);
      const nextCode = await compileLiveStyles(next);
      assert.match(nextCode, /changed-linked-source/);
      assert.doesNotMatch(nextCode, /accepted-linked-source/);
      assert.notEqual(nextCode, pinned);
    } else {
      await assert.rejects(acceptedStyles(fixture.root), {
        code: "build-invalid",
      });
    }
    await fs.writeFile(target, source);
    assert.equal(await compileLiveStyles(accepted), pinned);
  });
}
