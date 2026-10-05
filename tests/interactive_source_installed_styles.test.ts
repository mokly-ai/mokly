import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { DocumentService } from "../dist/server/demand/service.js";

import {
  installedStylesFixture,
  moduleCss,
  plainCss,
} from "./helpers/installed_styles.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const request of ["package-name", "relative", "repository"] as const) {
  for (const stylesheet of ["card.module.css", "plain.css"] as const) {
    for (const mutation of ["delete", "edit", "syntax error"] as const) {
      test(`accepted ${request} ${stylesheet} survives ${mutation} before first Live compilation`, async (t) => {
        const fixture = await installedStylesFixture(request);
        t.after(() => fixture.remove());
        assert.equal(
          (await fs.lstat(fixture.directory)).isSymbolicLink(),
          false,
        );
        const accepted = await acceptedStyles(fixture.root);
        const documents = new DocumentService(accepted);
        t.after(() => documents.close());
        const html = (await documents.read("home/index.desktop.html")).html;
        const name = html.match(/data-module="([^"]+)"/)?.[1];
        assert.ok(name);
        assert.ok(
          accepted.interactiveSources?.files.some((file) =>
            file.paths.includes(`node_modules/installed-style/${stylesheet}`),
          ),
          "the accepted stylesheet module already exists in the capture",
        );
        const file = path.join(fixture.directory, stylesheet);
        const original = stylesheet === "plain.css" ? plainCss : moduleCss;
        const javascript = await fs.readFile(
          path.join(fixture.directory, "index.js"),
          "utf8",
        );
        const metadata = await fs.readFile(
          path.join(fixture.directory, "package.json"),
          "utf8",
        );
        if (mutation === "delete") await fs.rm(file);
        else
          await fs.writeFile(
            file,
            mutation === "syntax error"
              ? '.card { color: "unterminated;\n'
              : ".card { color: blue; } .changed { color: green; }\n",
          );

        const pinned = await compileLiveStyles(accepted);
        assert.ok(
          pinned.includes(name),
          "Live keeps Static's accepted class map",
        );
        assert.equal(
          await fs.readFile(path.join(fixture.directory, "index.js"), "utf8"),
          javascript,
        );
        assert.equal(
          await fs.readFile(
            path.join(fixture.directory, "package.json"),
            "utf8",
          ),
          metadata,
        );
        assert.equal(
          (await documents.read("home/index.desktop.html")).html,
          html,
        );

        if (mutation === "edit") {
          const next = await acceptedStyles(fixture.root);
          assert.notDeepEqual(next.styleOutputs, accepted.styleOutputs);
          if (stylesheet === "card.module.css") {
            const nextCode = await compileLiveStyles(next);
            assert.notEqual(nextCode, pinned);
            assert.match(nextCode, /mokly_[a-f0-9]{12}_changed/);
          }
        } else if (mutation === "delete" || stylesheet === "card.module.css") {
          await assert.rejects(acceptedStyles(fixture.root), {
            code: "build-invalid",
          });
        }
        await fs.writeFile(file, original);
        assert.equal(await compileLiveStyles(accepted), pinned);
      });
    }
  }
}
