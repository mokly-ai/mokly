import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import {
  authenticateDocumentRanges,
  documentRangeRecords,
} from "../src/client/document_ranges.js";
import { compactRanges } from "../src/inspector/metadata.js";
import { documentRanges } from "../src/inspector/ranges.js";

import { markerDocument, rangeText } from "./marker_dom.js";
import {
  BUTTON_BODY,
  BUTTON_RANGES,
  HOME_BODY,
  HOME_RANGES,
} from "./serve_marker_documents.js";

type Ranges = Extract<CatalogueUsage, { status: "ready" }>["ranges"];

/** The published inspector's reader, over the metadata the adapters build. */
function inspector(body: string, ranges: Ranges): Range[] {
  return documentRanges(markerDocument(body), {
    ranges: compactRanges(ranges)!,
    links: [],
  });
}

/** The parent-side reader, over the records the same-origin adapter builds. */
function parent(body: string, ranges: Ranges) {
  return authenticateDocumentRanges(
    markerDocument(body),
    documentRangeRecords(ranges),
  );
}

function refused(body: string, ranges: Ranges = HOME_RANGES) {
  assert.throws(
    () => inspector(body, ranges),
    (error) => error === "invalid-boundary",
  );
  assert.equal(parent(body, ranges), undefined);
}

const slotAction = HOME_RANGES[5]!.target;
const SLOT_ACTION =
  slotAction.kind === "instance" ? slotAction.instanceKey : "";
const first = HOME_RANGES[0]!.target;
const KEY = first.kind === "instance" ? first.instanceKey : "";
// A component page whose root component renders another component.
const NESTED_BODY = `<nav><!--mokly-instance:start id="r-1" path="components/button" instance="${KEY}" props="${"0".repeat(64)}"--><button>Go</button><!--mokly-instance:end id="r-1"--></nav>`;
const NESTED_RANGES: Ranges = [
  { id: "r-0", target: { kind: "root" } },
  {
    id: "r-1",
    parentId: "r-0",
    target: { kind: "instance", instanceKey: KEY },
  },
];

test("a Serve screen's instances, nested instances and supplied slots authenticate", () => {
  const ranges = inspector(HOME_BODY, HOME_RANGES);
  assert.equal(ranges.length, 8);
  assert.equal(rangeText(ranges[0]!), '<Save & "go"> 3 Default');
  assert.equal(rangeText(ranges[3]!), 'Supplier <Save & "go">');
  assert.equal(rangeText(ranges[4]!), "Supplied text Slot action Default");
  assert.equal(rangeText(ranges[5]!), "Slot action Default");
  assert.match(
    rangeText(ranges[2]!),
    /^Details Supplier .*Slot action Default$/,
  );
  const authenticated = parent(HOME_BODY, HOME_RANGES)!;
  assert.equal(authenticated.byPath.size, 8);
  // The slot instance is placed twice, once in each `children` slot.
  assert.deepEqual(authenticated.ranges.get(SLOT_ACTION)!.map(rangeText), [
    "Slot action Default",
    "Slot action Default",
  ]);
});

test("a component page's root region is the body content, without a marker", () => {
  assert.equal(
    rangeText(inspector(BUTTON_BODY, BUTTON_RANGES)[0]!),
    "Save 2 Default",
  );
  assert.equal(
    rangeText(parent(BUTTON_BODY, BUTTON_RANGES)!.byPath.get("r-0")!),
    "Save 2 Default",
  );
  // A marked region inside the root names r-0 as its parent.
  const ranges = inspector(NESTED_BODY, NESTED_RANGES);
  assert.equal(rangeText(ranges[0]!), "Go");
  assert.equal(rangeText(ranges[1]!), "Go");
  assert.deepEqual(
    parent(NESTED_BODY, NESTED_RANGES)!.ranges.get(KEY)!.map(rangeText),
    ["Go"],
  );
});

test("the contract's slot marker with its instance attribute authenticates", () => {
  const body = HOME_BODY.replace(
    /<!--mokly-slot:start id="(r-\d+)" name/g,
    '<!--mokly-slot:start id="$1" instance="r-2" name',
  );
  assert.equal(inspector(body, HOME_RANGES).length, 8);
  assert.equal(parent(body, HOME_RANGES)!.byPath.size, 8);
});

test("markers that disagree with the usage are refused", () => {
  // Another instance key in a start marker.
  refused(
    HOME_BODY.replace(`instance="${KEY}"`, `instance="${"f".repeat(64)}"`),
  );
  // A slot record behind instance markers.
  refused(
    HOME_BODY.replace(
      'mokly-slot:start id="r-3"',
      'mokly-instance:start id="r-3"',
    ).replace('mokly-slot:end id="r-3"', 'mokly-instance:end id="r-3"'),
  );
  // An end marker with attributes, and a malformed marker.
  refused(
    HOME_BODY.replace(
      'instance:end id="r-0"',
      'instance:end id="r-0" name="x"',
    ),
  );
  refused(
    HOME_BODY.replace(
      '<!--mokly-slot:end id="r-3"-->',
      "<!--mokly-slot:end r-3-->",
    ),
  );
  // The previous marker form names no range.
  refused(
    HOME_BODY.replace(
      /<!--mokly-(?:instance|slot):(start|end) id="(r-\d+)"[^>]*-->/g,
      "<!--mokly-component:$1:$2-->",
    ),
  );
  // The root region carries no marker, and every marked region nests in it.
  refused(
    '<!--mokly-slot:start id="r-0" name="x"-->x<!--mokly-slot:end id="r-0"-->',
    BUTTON_RANGES,
  );
  refused(NESTED_BODY, [
    NESTED_RANGES[0]!,
    { id: "r-1", target: { kind: "instance", instanceKey: KEY } },
  ]);
});
