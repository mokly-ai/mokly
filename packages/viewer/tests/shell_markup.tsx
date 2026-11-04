/**
 * The client-rendered shell's first render as static markup. The standalone
 * chrome renders over one index and the details it already holds, so
 * presentation tests read the same tree the browser entry mounts.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import type { ShellContext } from "../src/shell/context.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import type { ShellInitialState } from "../src/shell/store_state.js";
import { StandaloneShellContents } from "../src/standalone/shell.js";

import { detailPairs, indexFixture } from "./catalogue_v9_fixture.js";

/** The origin the markup's shell routes resolve against. */
const SHELL_ORIGIN = "https://catalogue.test";

/** One standalone first render. */
export interface StandaloneMarkupOptions {
  /** The installed index; the protocol fixture by default. */
  index?: CatalogueReadModel;
  /** The held details; every fixture detail by default. */
  details?: readonly (readonly [DetailRequest, EntryDetailV4])[];
  /** The shell route, such as `/view/screens/home/`; home by default. */
  path?: string;
  initialState?: ShellInitialState;
  theme?: ShellContext["theme"];
}

/** Render the standalone shell as the browser entry first paints it. */
export function standaloneMarkup(
  options: StandaloneMarkupOptions = {},
): string {
  const index = options.index ?? indexFixture();
  return renderToStaticMarkup(
    <ShellStoreProvider
      context={{
        embedded: false,
        ...(options.theme ? { theme: options.theme } : {}),
      }}
      index={index}
      initialDetails={options.details ?? detailPairs()}
      {...(options.initialState ? { initialState: options.initialState } : {})}
      interactive={false}
      route={(catalogue) =>
        routeFromUrl(catalogue, new URL(options.path ?? "/", SHELL_ORIGIN))
      }
    >
      <StandaloneShellContents />
    </ShellStoreProvider>,
  );
}

/** The store of one non-interactive shell around isolated containers. */
export interface ShellStoreFixtureOptions {
  /** The installed index; the protocol fixture by default. */
  index?: CatalogueReadModel;
  /** The shell route, such as `/view/screens/home/`; home by default. */
  path?: string;
  /** The comparison transport, for a container that requests comparisons. */
  comparisonEnvironment?: ComparisonEnvironment;
}

/**
 * Supply the store of a non-interactive shell, as every mounted shell does.
 * On the home route, Details stay closed, both viewports show, and previews
 * use the Light scheme.
 */
export function ShellStoreFixture({
  children,
  comparisonEnvironment,
  index,
  path,
}: ShellStoreFixtureOptions & { children: ReactNode }) {
  return (
    <ShellStoreProvider
      {...(comparisonEnvironment ? { comparisonEnvironment } : {})}
      context={{ embedded: false }}
      index={index ?? indexFixture()}
      interactive={false}
      route={(catalogue) =>
        routeFromUrl(catalogue, new URL(path ?? "/", SHELL_ORIGIN))
      }
    >
      {children}
    </ShellStoreProvider>
  );
}

/** Render isolated containers inside {@link ShellStoreFixture} as markup. */
export function storeMarkup(
  children: ReactNode,
  options: ShellStoreFixtureOptions = {},
): string {
  return renderToStaticMarkup(
    <ShellStoreFixture {...options}>{children}</ShellStoreFixture>,
  );
}

/** The ids one markup string declares. */
export function htmlIds(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]!),
  );
}

/** The ids one markup string references through ARIA, labels and fragments. */
export function htmlReferences(html: string): string[] {
  return [
    ...html.matchAll(
      /\s(?:aria-controls|aria-describedby|aria-labelledby|for)="([^"]+)"|\shref="#([^"]+)"/g,
    ),
  ].flatMap((match) => (match[1] ?? match[2]!).split(" "));
}
