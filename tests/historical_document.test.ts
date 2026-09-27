import assert from "node:assert/strict";
import test from "node:test";

import { referencedRoutes } from "../dist/review/asset_references.js";
import { relocateHistoricalDocument } from "../dist/review/historical_document.js";

test("historical relocation rewrites one existing relative base", () => {
  const relocated = relocateHistoricalDocument(
    '<!doctype html><html><head><base href="../../assets/"><link rel="stylesheet" href="theme.css"></head><body></body></html>',
    "legacy/screens/account/view.html",
    "screens/account.html",
  );

  assert.equal(relocated.match(/<base\b/gi)?.length, 1);
  assert.match(
    relocated,
    /<base href="\.\.\/legacy\/assets\/" data-mokly-snapshot-base="">/,
  );
  assert.deepEqual(
    referencedRoutes("snapshots/before/screens/account.html", relocated),
    ["snapshots/before/legacy/assets/theme.css"],
  );
});

test("an injected snapshot base keeps HTML anchors canonical", () => {
  const relocated = relocateHistoricalDocument(
    '<!doctype html><html><head><link rel="stylesheet" href="../../theme.css"></head><body><a href="#section">Section</a><h2 id="section">Section</h2></body></html>',
    "legacy/deep/account.html",
    "screens/account.html",
  );

  assert.match(
    relocated,
    /<base data-mokly-snapshot-base="" href="\.\.\/legacy\/deep\/">/,
  );
  assert.match(relocated, /href="\.\.\/\.\.\/screens\/account\.html#section"/);
  assert.deepEqual(
    referencedRoutes("snapshots/before/screens/account.html", relocated),
    ["snapshots/before/theme.css"],
  );
});

test("an injected snapshot base keeps plain SVG href fragments canonical", () => {
  const relocated = relocateHistoricalDocument(
    '<!doctype html><html><head><title>t</title></head><body><svg><symbol id="icon"></symbol><use href="#icon"></use></svg></body></html>',
    "design/browse/foo.desktop.html",
    "screens/foo.desktop.html",
  );

  assert.match(
    relocated,
    /<use href="\.\.\/\.\.\/screens\/foo\.desktop\.html#icon">/,
  );
});

test("an injected snapshot base keeps xlink:href fragments canonical", () => {
  const relocated = relocateHistoricalDocument(
    '<!doctype html><html><head><title>t</title></head><body><svg><symbol id="icon"></symbol><use xlink:href="#icon"></use></svg></body></html>',
    "design/browse/foo.desktop.html",
    "screens/foo.desktop.html",
  );

  assert.match(
    relocated,
    /<use xlink:href="\.\.\/\.\.\/screens\/foo\.desktop\.html#icon">/,
  );
});

test("relocation is deterministic and leaves other fragment shapes untouched", () => {
  const source = `<!doctype html><html><head><title>t</title></head><body>
    <a href="mock:details" data-mokly-link="details">Details</a>
    <svg><defs><linearGradient id="gradient"></linearGradient></defs>
      <rect fill="url(#gradient)" clip-path="url(#clip)" mask="url(#mask)" marker-start="url(#marker)" marker-mid="url(#marker)" marker-end="url(#marker)" filter="url(#filter)" style="fill: url(#gradient); clip-path: url(#clip)"></rect>
      <use href="sprite.svg#icon"></use>
    </svg>
  </body></html>`;

  const first = relocateHistoricalDocument(
    source,
    "design/browse/foo.desktop.html",
    "screens/foo.desktop.html",
  );
  const second = relocateHistoricalDocument(
    source,
    "design/browse/foo.desktop.html",
    "screens/foo.desktop.html",
  );

  assert.equal(first, second);
  assert.match(first, /href="mock:details" data-mokly-link="details"/);
  assert.match(first, /fill="url\(#gradient\)"/);
  assert.match(first, /clip-path="url\(#clip\)"/);
  assert.match(first, /mask="url\(#mask\)"/);
  assert.match(first, /marker-start="url\(#marker\)"/);
  assert.match(first, /marker-mid="url\(#marker\)"/);
  assert.match(first, /marker-end="url\(#marker\)"/);
  assert.match(first, /filter="url\(#filter\)"/);
  assert.match(
    first,
    /style="fill: url\(#gradient\); clip-path: url\(#clip\)"/,
  );
  assert.match(first, /href="sprite\.svg#icon"/);
});
