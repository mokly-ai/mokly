/**
 * The client-rendered shell's first render as static markup. The standalone
 * chrome renders over one index and the details it already holds, so
 * presentation tests read the same tree the browser entry mounts.
 */

import { renderToStaticMarkup } from "react-dom/server";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV1,
} from "../src/catalogue/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import type { ShellInitialState } from "../src/shell/store_state.js";
import { StandaloneShellContents } from "../src/standalone/shell.js";

import { detailPairs, indexFixture } from "./catalogue_v7_fixture.js";

/** The origin the markup's shell routes resolve against. */
export const SHELL_ORIGIN = "https://catalogue.test";

/** One standalone first render. */
export interface StandaloneMarkupOptions {
  /** The installed index; the protocol fixture by default. */
  index?: CatalogueReadModel;
  /** The held details; every fixture detail by default. */
  details?: readonly (readonly [DetailRequest, EntryDetailV1])[];
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
