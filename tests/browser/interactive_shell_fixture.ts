import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import {
  CachedInteractiveBundler,
  EsbuildInteractiveBundleCompiler,
  type InteractiveBundle,
  type InteractiveBundleRequest,
  type InteractiveBundler,
} from "../../dist/interactive/bundle.js";
import { NodeInteractiveServerFactory } from "../../dist/interactive/server.js";
import type { CatalogueServerFactory } from "../../dist/server/factory.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { ServerOptions } from "../../dist/server/http_types.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

/** Real browser bundles that wait until a test opens the gate. */
export class GatedInteractiveBundler implements InteractiveBundler {
  readonly requests: string[] = [];
  private readonly bundler = new CachedInteractiveBundler(
    new EsbuildInteractiveBundleCompiler(),
  );
  private release: () => void = () => undefined;
  private readonly opened = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  async build(request: InteractiveBundleRequest): Promise<InteractiveBundle> {
    this.requests.push(request.generation);
    await this.opened;
    return this.bundler.build(request);
  }

  invalidate(generation: string): void {
    this.bundler.invalidate(generation);
  }

  /** Let every pending and later build compile the real consumer graph. */
  open(): void {
    this.release();
  }
}

class GatedServerFactory implements CatalogueServerFactory {
  constructor(private readonly bundler: InteractiveBundler) {}

  start(config: ResolvedConfig, options: ServerOptions) {
    return startCatalogueServer(config, {
      ...options,
      interactiveServerFactory: new NodeInteractiveServerFactory(this.bundler),
    });
  }
}

/**
 * Screens, a stateful component, a page, a flow and one removed screen, plus
 * a screen and a component that opt out of Live beside the eligible ones.
 */
export function interactiveShellSource(current: boolean): string {
  const details = current ? "Current details" : "Previous details";
  return `import React, { useState } from "react";
import { defineComponent, definePage, defineScreen, defineUseCase, MockLink } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [] };
function Counter({ label }) {
  const [count, setCount] = useState(0);
  return <main><p id="count">{label}: {count}</p><button id="increment" type="button" onClick={() => setCount((value) => value + 1)}>Increment</button> <MockLink id="details-link" to="details">Open details</MockLink></main>;
}
const counter = defineComponent({ ...metadata, path: "counter", title: "Counter", description: "A counter that remembers clicks", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } }, controls: { label: { kind: "text", label: "Label", maxLength: 40 } }, render: (props) => <Counter label={props.label} />, variants: [{ slug: "default", title: "Default", props: { label: "Saved" } }, { slug: "other", title: "Other", props: { label: "Other" } }] });
const badge = defineComponent({ ...metadata, interactive: false, path: "badge", title: "Badge", description: "A badge that stays static", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } }, controls: { label: { kind: "text", label: "Label", maxLength: 40 } }, render: (props) => <Counter label={props.label} />, variants: [{ slug: "default", title: "Default", props: { label: "Badge" } }, { slug: "quiet", title: "Quiet", props: { label: "Quiet" } }] });
export const mockups = [
  defineScreen({ ...metadata, path: "home", title: "Home", description: "Stateful home", useCasePaths: ["tour"], mobile: <Counter label="Home" />, desktop: <Counter label="Home" /> }),
  defineScreen({ ...metadata, path: "details", title: "Details", description: "Details", useCasePaths: ["tour"], mobile: <main id="details">${details}</main>, desktop: <main id="details">${details}</main> }),
  defineScreen({ ...metadata, interactive: false, path: "notes", title: "Notes", description: "Notes that stay static", useCasePaths: [], mobile: <Counter label="Notes" />, desktop: <Counter label="Notes" /> }),
  ${current ? "" : 'defineScreen({ ...metadata, path: "retired", title: "Retired", description: "Retired", useCasePaths: [], mobile: <main>Retired</main>, desktop: <main>Retired</main> }),'}
  definePage({ ...metadata, path: "guide", title: "Guide", description: "Guide", render: () => "<!doctype html><html><body><h1>Guide</h1></body></html>" }),
  defineUseCase({ ...metadata, path: "tour", title: "Tour", description: "Tour", steps: [{ screenPath: "home" }, { screenPath: "details" }] }),
  ...counter.entries,
  ...badge.entries,
];
`;
}

/** Real Serve over a Git baseline; Live bundles wait for `gate.open()`. */
export async function interactiveShellFixture(
  interactive: "off" | "serve" = "serve",
) {
  const fixture = await createFixture(interactiveShellSource(false), {
    extraConfig: `interactive: ${JSON.stringify(interactive)},`,
  });
  const gate = new GatedInteractiveBundler();
  try {
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("add", ".");
    git("commit", "-qm", "test: baseline");
    await fs.writeFile(fixture.entryPath, interactiveShellSource(true));
    const running = await serve(
      config,
      { base: "HEAD", port: 0, watch: false },
      { serverFactory: new GatedServerFactory(gate) },
    );
    fixture.beforeRemove(() => running.close());
    await waitForClassifiedCount(running.url, 3);
    return {
      gate,
      liveOrigin: running.interactiveOrigin,
      url: running.url,
      close: () => removeFixture(fixture),
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}
