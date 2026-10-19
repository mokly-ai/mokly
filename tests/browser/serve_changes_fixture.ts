import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { serveHost, type BrowserHost } from "./hosts.js";

const execute = promisify(execFile);
export const screen = (title: string, body: string, metadata = "") =>
  `---\ntitle: ${title}\n${metadata}---\n${body}`;

/** A real Git base and watched working catalogue, isolated for each test. */
export async function serveChanges(
  options: { removedComponent?: boolean } = {},
) {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context", "serve-changes-"),
  );
  let host: BrowserHost | undefined;
  let starting: Promise<BrowserHost> | undefined;
  const abort = new AbortController();
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      abort.abort();
      const active = host ?? (await starting?.catch(() => undefined));
      await active?.close();
      await fs.rm(root, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  const write = async (name: string, contents: string) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), contents);
  };
  try {
    await write(
      "mokly.config.json",
      JSON.stringify({
        repoRoot: ".",
        roots: [{ dir: "specs" }],
        review: { base: "fixture-base" },
        stylesheets: [{ match: "**/index*.html", stylesheets: ["theme.css"] }],
      }),
    );
    await write("theme.css", "p { color: rgb(255, 0, 0); }");
    await write(
      "specs/sample.screen.html",
      screen("Sample", "<p>Before sample</p>"),
    );
    await write(
      "specs/old.screen.html",
      screen("Moved screen", "<div>Moved content</div>"),
    );
    await write(
      "specs/removed.screen.html",
      screen("Removed screen", "<h1>Historical screen</h1>"),
    );
    await write(
      "specs/retired.page.html",
      screen(
        "Retired page",
        "<!doctype html><html><head><title>Retired</title></head><body><h1>Historical page</h1></body></html>",
      ),
    );
    await write(
      "specs/stable.screen.html",
      screen("Stable screen", "<div>Stable content</div>"),
    );
    if (options.removedComponent) {
      await write(
        "specs/widget.component.html",
        screen(
          "Retired widget",
          "<div>Historical widget</div>",
          "element: fixture-widget\npropSchema: { type: object, additionalProperties: false, properties: {} }\n",
        ),
      );
    }
    await git("init", "-b", "main");
    await git("config", "user.name", "Mokly fixture");
    await git("config", "user.email", "fixture@example.invalid");
    await git("add", ".");
    await git("commit", "-m", "fixture: base catalogue");
    await git("branch", "fixture-base");
    await write(
      "specs/sample.screen.html",
      screen("Sample", "<p>Current sample</p>"),
    );
    await write("theme.css", "p { color: rgb(0, 0, 255); }");
    await fs.rename(
      path.join(root, "specs/old.screen.html"),
      path.join(root, "specs/moved.screen.html"),
    );
    await write(
      "specs/moved.screen.html",
      screen("Moved screen", "<div>Moved content</div>", "movedFrom: old\n"),
    );
    await fs.rm(path.join(root, "specs/removed.screen.html"));
    await fs.rm(path.join(root, "specs/retired.page.html"));
    if (options.removedComponent) {
      await fs.rm(path.join(root, "specs/widget.component.html"));
    }
    starting = serveHost(
      [
        path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
        "serve",
        "--port",
        "0",
        "--sidecars",
        "1",
      ],
      root,
      abort.signal,
    );
    host = await starting;
    const url = host.url;
    const index = async () =>
      (await (
        await fetch(`${url}/mokly-viewer/index.json`)
      ).json()) as CatalogueReadModel;
    const ready = async (after = 0) => {
      try {
        await expect
          .poll(
            async () => {
              const current = await index();
              return (
                current.revision > after && current.changesStatus === "ready"
              );
            },
            { timeout: 30_000 },
          )
          .toBe(true);
      } catch (cause) {
        throw new Error(
          `Serve Changes did not become ready:\n${host?.diagnostics?.()}`,
          { cause },
        );
      }
      return index();
    };
    await ready();
    return { root, url, close, git, write, index, ready };
  } catch (error) {
    await close();
    throw error;
  }
}
