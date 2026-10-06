import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";
import { MoveResources } from "../dist/review/moves/resources.js";

const page: ManifestEntry = {
  kind: "page",
  path: "target",
  title: "Target",
  description: "A target",
  sourcePath: "specs/target.ts",
  declaredDependencies: [],
  relatedDocs: [],
};
const screen: ManifestEntry = {
  ...page,
  kind: "screen",
  colorSchemes: ["light"],
  useCasePaths: [],
};
const bytes = new Map([["asset.svg", Buffer.from("asset")]]);
const changedBytes = new Map([["asset.svg", Buffer.from("changed")]]);
const cases: {
  name: string;
  before: ManifestEntry[];
  after: ManifestEntry[];
  resources?: MoveResources;
  equal: boolean;
}[] = [
  { name: "stable catalogue", before: [page], after: [page], equal: true },
  {
    name: "kind replacement at the same route",
    before: [page],
    after: [{ ...page, kind: "use-case", steps: [{ screenPath: "guide" }] }],
    equal: false,
  },
  {
    name: "different generated route sets of equal size",
    before: [screen],
    after: [{ ...screen, colorSchemes: ["dark"] }],
    equal: false,
  },
  {
    name: "same resource routes with different bytes",
    before: [page],
    after: [page],
    resources: new MoveResources(bytes, changedBytes),
    equal: true,
  },
  {
    name: "paired identity resource routes",
    before: [page],
    after: [page],
    resources: new MoveResources(
      bytes,
      bytes,
      new Map([["asset.svg", "asset.svg"]]),
    ),
    equal: true,
  },
  {
    name: "one-sided attachment with an empty pairing",
    before: [page],
    after: [page],
    resources: new MoveResources(bytes, new Map(), new Map()),
    equal: false,
  },
  {
    name: "paired resource move with both routes present",
    before: [page],
    after: [page],
    resources: new MoveResources(
      new Map([...bytes, ["next.svg", Buffer.from("next")]]),
      new Map([...bytes, ["next.svg", Buffer.from("next")]]),
      new Map([["asset.svg", "next.svg"]]),
      new Map(),
      new Map([["guide/index.desktop.html", new Set(["next.svg"])]]),
    ),
    equal: false,
  },
];
const sources = [
  '<a href="../target/index.html">Target</a>',
  '<a href="../target/index.mobile.html">Target</a>',
  '<a href="../target/index.html" data-mokly-link="TaRgEt">Target</a>',
  '<a href="../asset.svg">Attachment</a>',
  '<img src="../asset.svg?size=2#mark">',
  '<img srcset="../asset.svg 1x, ../next.svg 2x">',
  '<style>.entry{background:url("../asset.svg")}</style>',
  '<template><img src="../asset.svg"></template>',
];

for (const item of cases)
  test(`equal-source link proof is sound: ${item.name}`, () => {
    const links = catalogueLinkNormalizer(
      item.before,
      item.after,
      [],
      item.resources,
    )("guide/index.desktop.html", "guide/index.desktop.html");
    for (const source of sources)
      if (links.equalSource)
        assert.equal(links.before(source), links.after(source), source);
    assert.equal(links.equalSource, item.equal);
  });
