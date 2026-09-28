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

/** Screens, a stateful component, a page, a flow and one removed screen. */
export function interactiveShellSource(current: boolean): string {
  const ids = [
    "home",
    "details",
    ...(current ? [] : ["retired"]),
    "guide",
    "tour",
    "counter",
  ];
  const details = current ? "Current details" : "Previous details";
  return `import React, { useState } from "react";
import { defineCollection, defineComponent, definePage, defineScreen, defineUseCase, MockLink } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [] };
function Counter({ label }) {
  const [count, setCount] = useState(0);
  return <main><p id="count">{label}: {count}</p><button id="increment" type="button" onClick={() => setCount((value) => value + 1)}>Increment</button> <MockLink id="details-link" to="details">Open details</MockLink></main>;
}
const counter = defineComponent({ ...metadata, id: "counter", title: "Counter", description: "A counter that remembers clicks", route: "components/counter.html", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } }, controls: { label: { kind: "text", label: "Label", maxLength: 40 } }, render: (props) => <Counter label={props.label} />, variants: [{ id: "default", title: "Default", props: { label: "Saved" } }, { id: "other", title: "Other", props: { label: "Other" } }] });
export const mockups = [
  defineCollection({ ...metadata, childIds: ${JSON.stringify(ids)}, description: "Live fixtures", id: "fixture", title: "Fixture" }),
  defineScreen({ ...metadata, id: "home", title: "Home", route: "screens/home.html", description: "Stateful home", useCaseIds: ["tour"], mobile: <Counter label="Home" />, desktop: <Counter label="Home" /> }),
  defineScreen({ ...metadata, id: "details", title: "Details", route: "screens/details.html", description: "Details", useCaseIds: ["tour"], mobile: <main id="details">${details}</main>, desktop: <main id="details">${details}</main> }),
  ${current ? "" : 'defineScreen({ ...metadata, id: "retired", title: "Retired", route: "screens/retired.html", description: "Retired", useCaseIds: [], mobile: <main>Retired</main>, desktop: <main>Retired</main> }),'}
  definePage({ ...metadata, id: "guide", title: "Guide", route: "guide.html", description: "Guide", render: () => "<!doctype html><html><body><h1>Guide</h1></body></html>" }),
  defineUseCase({ ...metadata, id: "tour", title: "Tour", route: "user-flows/tour.html", description: "Tour", steps: [{ screenId: "home" }, { screenId: "details" }] }),
  counter.entry,
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
