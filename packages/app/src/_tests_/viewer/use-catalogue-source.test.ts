import assert from "node:assert/strict";
import { test } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { catalogueReads } from "../../viewer/catalogue-source.web";
import { CatalogueSourceContext } from "../../viewer/source-context";
import { createCatalogueSources } from "../../viewer/source-store";
import type { SourceAccess } from "../../viewer/source-store";
import { useCatalogueSource } from "../../viewer/use-catalogue-source";
import type { CatalogueRead } from "../../viewer/use-catalogue-source";
import { tabAt, withWindowAsync } from "../page-window";

import {
  bearerAccess,
  current,
  guidePath,
  host,
  packagedIndex,
  root,
} from "./catalogue-read-fixture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("a rebuilt route selects its newly confirmed bearer access", async () => {
  const { calls, transport } = host({ [guidePath]: current("guide") });
  const index = await packagedIndex();
  const store = createCatalogueSources({
    ...catalogueReads(transport),
    index: async () => ({ index }),
  });
  const selected: SourceAccess[] = [];
  const sources: typeof store = {
    ...store,
    select(request) {
      selected.push(request.access);
      return store.select(request);
    },
  };
  let catalogue: CatalogueRead | undefined;
  function Route({ access }: { access: SourceAccess }) {
    catalogue = useCatalogueSource({ origin: root.origin, access });
    return null;
  }

  const page = Object.assign(new EventTarget(), {
    location: tabAt(),
    event: undefined,
    HTMLIFrameElement: class {},
  });
  const fragment = Object.assign(new EventTarget(), {
    nodeType: 11,
    nodeName: "#document-fragment",
    ownerDocument: new EventTarget(),
    textContent: "",
    firstChild: null,
  });
  const app = createRoot(fragment as unknown as DocumentFragment);
  const show = (access?: SourceAccess) =>
    act(async () => {
      app.render(
        createElement(
          CatalogueSourceContext.Provider,
          { value: sources },
          access === undefined ? null : createElement(Route, { access }),
        ),
      );
    });

  await withWindowAsync(page, async () => {
    try {
      const first = bearerAccess(() => "first-attempt");
      await show(first);
      assert.equal(selected.at(-1), first);
      const before = catalogue?.state.read;
      assert.equal(before?.status, "ready");
      await before.detail("guide");

      await show();
      const next = bearerAccess(() => "next-attempt");
      await show(next);
      assert.equal(selected.at(-1), next);
      assert.equal(catalogue?.state.read, before);
      await before.detail("guide");
    } finally {
      act(() => app.unmount());
    }
  });
  assert.deepEqual(
    calls.map(({ authorization }) => authorization),
    ["Bearer first-attempt", "Bearer next-attempt"],
  );
});
