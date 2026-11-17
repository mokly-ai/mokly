/**
 * One node drawn inside the catalogue renderer's wrapper, as static markup:
 * the Firna DOM backend and token styles, the render context and the static
 * control theme around the node. Mokly assembles each document's head around
 * this wrapper; `document.test.ts` checks that part in the build output.
 */

import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ColorScheme, Viewport } from "@mokly/mokly";

import { MockupDocument } from "../document";

/** The markup of one fixture screen that draws this node. */
export function wrapperMarkup(
  node: ReactNode,
  context: { viewport: Viewport; colorScheme: ColorScheme },
): string {
  return renderToStaticMarkup(
    createElement(MockupDocument, {
      entry: { kind: "screen", path: "design/fixture", title: "Fixture" },
      ...context,
      children: node,
    }),
  );
}
