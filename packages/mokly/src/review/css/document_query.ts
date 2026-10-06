/** Compile and traverse selectors behind one contained error boundary. */
import { compile, selectOne } from "css-select";
import { SelectorType, stringify } from "css-what";
import type { Selector } from "css-what";
import { html } from "parse5";

import { cssDocumentOptions } from "./document.js";
import type { CssDocument, CssElement } from "./document.js";
import { CssSelectorError } from "./match_types.js";
import { nthSelectors, staticSelectors } from "./pseudos.js";

/** Match mixed HTML/SVG/MathML documents without losing foreign-name case in negations. */
export function matchesDocument(
  query: Selector[][],
  document: CssDocument,
): boolean {
  try {
    const options = cssDocumentOptions(document);
    const pseudos: Record<string, (element: CssElement) => boolean> = {};
    let nextPredicate = 0;
    const rewrite = (selectors: Selector[][]): Selector[][] =>
      selectors.map((selector) =>
        selector.map((token): Selector => {
          if (
            token.type === SelectorType.Tag ||
            token.type === SelectorType.Attribute
          ) {
            const htmlMatch = compile([[{ ...token }]], options);
            const foreignMatch = compile([[{ ...token }]], {
              ...options,
              xmlMode: true,
              quirksMode: false,
            });
            const name = `-mokly-node-${nextPredicate++}`;
            pseudos[name] = (element) =>
              element.namespaceURI === html.NS.HTML
                ? htmlMatch(element)
                : foreignMatch(element);
            return { type: SelectorType.Pseudo, name, data: null };
          }
          if (token.type === SelectorType.Pseudo && Array.isArray(token.data))
            return { ...token, data: rewrite(token.data) };
          const nth = nthSelectors(token);
          return nth && token.type === SelectorType.Pseudo
            ? {
                ...token,
                data: `${nth.formula} of ${stringify(rewrite(nth.selectors))}`,
              }
            : token;
        }),
      );
    const selectors = rewrite(staticSelectors(query));
    const predicate = compile(selectors, { ...options, pseudos });
    return selectOne(predicate, document, options) !== null;
  } catch (cause) {
    throw new CssSelectorError("selector-parse-failed", cause);
  }
}
