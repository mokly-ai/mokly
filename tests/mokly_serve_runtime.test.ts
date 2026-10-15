import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { fenceDetail } from "../packages/viewer/src/catalogue/detail_fences.js";
import { readEntryDetail } from "../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

const shim = fileURLToPath(
  new URL("../packages/mokly/bin/mokly.mjs", import.meta.url),
);

test("the installed shim resolves the viewer from another working directory", async (context) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-shim-viewer-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [shim, "--version"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, MOKLY_OUTPUT: "plain" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(result.stderr, "");
});

test(
  "the installed shim serves a catalogue, publishes consumers, and renders live props",
  { timeout: 30_000 },
  async (context) => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-shim-serve-"),
    );
    await fs.mkdir(path.join(directory, "specs"));
    await fs.writeFile(path.join(directory, "mokly.config.json"), "{}");
    await fs.writeFile(
      path.join(directory, "specs/button.component.html"),
      "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}, required: [label]}\nprops: {label: Saved}\n---\n<button>{{label}}</button>",
    );
    await fs.writeFile(
      path.join(directory, "specs/panel.component.html"),
      "---\ntitle: Panel\nelement: ui-panel\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<section><slot></slot></section>",
    );
    await fs.writeFile(
      path.join(directory, "specs/home.screen.html"),
      '---\ntitle: Home\n---\n<ui-panel><ui-button label="Used"></ui-button></ui-panel>',
    );
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      MOKLY_OUTPUT: "plain",
    };
    delete environment.MOKLY_VIEWER_DIST;
    const child = spawn(
      process.execPath,
      [shim, "serve", "--no-watch", "--port", "0"],
      { cwd: directory, env: environment, stdio: ["ignore", "pipe", "pipe"] },
    );
    const exited = once(child, "exit");
    let errors = "";
    child.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.toString();
    });
    context.after(async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGINT");
      await exited;
      await fs.rm(directory, { recursive: true, force: true });
    });
    const signal = AbortSignal.timeout(15_000);
    const lines = createInterface({ input: child.stdout });
    const [line] = await Promise.race([
      once(lines, "line", { signal }),
      exited.then(() => {
        throw new Error(`Serve exited before readiness: ${errors}`);
      }),
    ]);
    lines.close();
    assert.match(
      String(line),
      /^Mokly listening at http:\/\/127\.0\.0\.1:\d+$/,
    );
    const url = String(line).slice("Mokly listening at ".length);
    const shell = await fetch(`${url}/view/home/`, { signal });
    assert.equal(shell.status, 200);
    assert.match(await shell.text(), /data-mokly-shell/);
    const browser = await fetch(`${url}/mokly-viewer/client/shell.js`, {
      signal,
    });
    assert.equal(browser.status, 200);
    assert.ok((await browser.text()).length > 0);
    const events = await fetch(`${url}/mokly-viewer/events`, { signal });
    const stream = events.body!.getReader();
    let revision: number;
    for (;;) {
      const index = await (
        await fetch(`${url}/mokly-viewer/index.json`, { signal })
      ).json();
      const detail = await (
        await fetch(`${url}/mokly-viewer/entries/button.json`, { signal })
      ).json();
      if (
        detail.revision === index.revision &&
        detail.workspace?.usedBy.some(
          (use: { entryPath: string }) => use.entryPath === "home",
        )
      ) {
        revision = index.revision;
        assert.ok(revision > 1);
        assert.ok(
          detail.views.every(
            (view: { usage: { status: string } }) =>
              view.usage.status === "ready",
          ),
        );
        const model = readCatalogueIndex(index);
        assert.equal(
          fenceDetail(model, { path: "button" }, readEntryDetail(detail)).kind,
          "accepted",
        );
        const home = readEntryDetail(
          await (
            await fetch(`${url}/mokly-viewer/entries/home.json`, { signal })
          ).json(),
        );
        assert.equal(
          fenceDetail(model, { path: "home" }, home).kind,
          "accepted",
        );
        for (const { usage } of home.views) {
          assert.equal(usage.status, "ready");
          if (usage.status !== "ready") assert.fail("Home usage is not ready");
          assert.equal(usage.instances.length, 2);
          assert.equal(usage.slots.length, 1);
          const button = usage.instances.find(
            (use) => use.componentId === "button",
          );
          assert.equal(button?.slotKey, usage.slots[0]!.key);
          assert.ok(
            detail.workspace.usedBy.some(
              (use: { entryPath: string; instanceKey: string }) =>
                use.entryPath === "home" && use.instanceKey === button?.key,
            ),
          );
        }
        break;
      }
      await stream.read();
    }
    await stream.cancel();
    const live = await (
      await fetch(`${url}/mokly-viewer/live.json`, { signal })
    ).json();
    const rendered = await fetch(`${url}/mokly-viewer/components/render`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        origin: url,
        "x-mokly-render-token": live.render.token,
      },
      body: JSON.stringify({
        entryPath: "button",
        viewport: "mobile",
        colorScheme: "light",
        revision,
        pageId: "a".repeat(32),
        overrides: { label: { kind: "set", value: "Edited" } },
      }),
    });
    assert.equal(rendered.status, 200, await rendered.clone().text());
    const preview = await rendered.json();
    const html = await (
      await fetch(`${url}${preview.previewUrl}`, { signal })
    ).text();
    assert.match(html, /Edited/);
    assert.doesNotMatch(html, /inspector\.js/);
    child.kill("SIGINT");
    const [code] = await exited;
    assert.equal(code, 0, errors);
    assert.equal(errors, "");
  },
);
