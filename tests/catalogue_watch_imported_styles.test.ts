import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { version, waitForUpdate } from "./helpers/watched_catalogue.js";
import { waitForBrowserReload } from "./helpers/watched_events.js";

for (const kind of ["plain", "module", "nested", "asset", "font"] as const) {
  test(
    `watched ${kind} CSS input rebuilds and emits a browser reload`,
    {
      timeout: 60_000,
    },
    async (context) => {
      const fixture = await changedFixture(
        context,
        undefined,
        { extraConfig: "watch: { debounceMs: 0 }," },
        async (candidate) => {
          const css = kind === "module" ? "fixture.module.css" : "fixture.css";
          const filename = kind === "nested" ? "nested.css" : css;
          await fs.writeFile(
            path.join(candidate.entriesDir, filename),
            kind === "asset"
              ? '.entry { background: url("./icon.png"); }'
              : kind === "font"
                ? '@font-face { font-family: Fixture; src: url("./font.woff2"); }'
                : ".entry { color: red; }",
          );
          if (kind === "nested")
            await fs.writeFile(
              path.join(candidate.entriesDir, css),
              '@import "./nested.css";',
            );
          if (kind === "asset" || kind === "font")
            await fs.writeFile(
              path.join(
                candidate.entriesDir,
                kind === "font" ? "font.woff2" : "icon.png",
              ),
              Buffer.from([0, 1]),
            );
          await fs.appendFile(candidate.entryPath, `\nimport "./${css}";`);
        },
      );
      const running = await serve(fixture.config, { port: 0, watch: true });
      fixture.beforeRemove(() => running.close());
      const initial = version(
        await fetch(running.url).then((response) => response.text()),
      );
      const route = "mokly-generated/styles/entries/fixture.mockup.tsx.css";
      const relative =
        kind === "nested"
          ? "nested.css"
          : kind === "module"
            ? "fixture.module.css"
            : "fixture.css";
      const event = await waitForBrowserReload(running.url, initial, () =>
        kind === "asset" || kind === "font"
          ? fs.writeFile(
              path.join(
                fixture.entriesDir,
                kind === "font" ? "font.woff2" : "icon.png",
              ),
              Buffer.from([0, 255]),
            )
          : fs.writeFile(
              path.join(fixture.entriesDir, relative),
              ".entry { color: blue; }",
            ),
      );
      assert.ok(event > initial);
      await waitForUpdate(running.url, initial);
      const deadline = Date.now() + 15_000;
      let accepted = false;
      while (!accepted && Date.now() < deadline) {
        const response = await fetch(
          `${running.url}/static/${kind === "asset" || kind === "font" ? `mokly-generated/assets/entries/${kind === "font" ? "font.woff2" : "icon.png"}` : route}`,
        );
        if (kind === "asset" || kind === "font")
          accepted = Buffer.from(await response.arrayBuffer()).equals(
            Buffer.from([0, 255]),
          );
        else accepted = /blue|#00f/i.test(await response.text());
        if (!accepted) await setTimeout(80);
      }
      assert.equal(
        accepted,
        true,
        "accepted generation did not contain the edited input",
      );
      const content = (html: string) => {
        const revision = /data-mokly-content-version="(\d+)"/.exec(html)?.[1];
        assert.ok(revision);
        return Number(revision);
      };
      const settled = content(
        await fetch(running.url).then((response) => response.text()),
      );
      await fs.writeFile(
        path.join(fixture.mockupsDir, route),
        ".outside{color:red}",
      );
      await setTimeout(500);
      assert.equal(
        content(await fetch(running.url).then((response) => response.text())),
        settled,
      );
    },
  );
}
