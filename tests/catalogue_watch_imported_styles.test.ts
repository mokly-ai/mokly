import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { version } from "./helpers/watched_catalogue.js";
import { waitForWatchedResource } from "./helpers/watched_events.js";

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
      await waitForWatchedResource<string | Buffer>({
        origin: running.url,
        previous: initial,
        resource: `${running.url}/static/${kind === "asset" || kind === "font" ? `mokly-generated/assets/entries/${kind === "font" ? "font.woff2" : "icon.png"}` : route}`,
        edit: () =>
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
        read: async (response) =>
          kind === "asset" || kind === "font"
            ? Buffer.from(await response.arrayBuffer())
            : await response.text(),
        accept: (value) =>
          typeof value === "string"
            ? /blue|#00f/i.test(value)
            : value.equals(Buffer.from([0, 255])),
      });
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
