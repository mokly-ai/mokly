/**
 * The source of `pricing.mockup.tsx` that the open-foundation frame shows in
 * its code panel, written against the real `defineScreen` API, with one prop
 * per line on the featured PriceCard. Lines 11 to 15 and 17 draw that
 * PriceCard, so the panel lights them and the wire joins them to the card
 * on the artboard. The lines match the open-foundation mockup.
 */
import type { CodeLine } from "../code-lines.js";

/** The source lines, as syntax tokens. */
export const PRICING_SOURCE: readonly CodeLine[] = [
  [
    ["keyword", "import"],
    " { ",
    ["fn", "defineScreen"],
    " } ",
    ["keyword", "from"],
    " ",
    ["string", '"@mokly/mokly"'],
    ";",
  ],
  [],
  [
    ["keyword", "import"],
    " { ",
    ["type", "Button"],
    " } ",
    ["keyword", "from"],
    " ",
    ["string", '"../components/button"'],
    ";",
  ],
  [
    ["keyword", "import"],
    " { ",
    ["type", "Page"],
    " } ",
    ["keyword", "from"],
    " ",
    ["string", '"../components/page"'],
    ";",
  ],
  [
    ["keyword", "import"],
    " { ",
    ["type", "PriceCard"],
    " } ",
    ["keyword", "from"],
    " ",
    ["string", '"../components/price-card"'],
    ";",
  ],
  [],
  [["keyword", "export default"], " ", ["fn", "defineScreen"], "({"],
  ["  ", ["punct", "title"], ": ", ["string", '"Pricing"'], ","],
  [
    "  ",
    ["punct", "render"],
    ": (_props, { viewport }) ",
    ["keyword", "=>"],
    " (",
  ],
  [
    "    <",
    ["type", "Page"],
    " ",
    ["attr", "viewport"],
    "={viewport} ",
    ["attr", "title"],
    "=",
    ["string", '"Pick your plan"'],
    ">",
  ],
  ["      <", ["type", "PriceCard"]],
  ["        ", ["attr", "plan"], "=", ["string", '"regular"']],
  ["        ", ["attr", "padding"], "={", ["number", "24"], "}"],
  ["        ", ["attr", "featured"]],
  ["      >"],
  [
    "        <",
    ["type", "Button"],
    " ",
    ["attr", "tone"],
    "=",
    ["string", '"primary"'],
    " ",
    ["attr", "label"],
    "=",
    ["string", '"Choose Regular"'],
    " />",
  ],
  ["      </", ["type", "PriceCard"], ">"],
  [
    "      <",
    ["type", "PriceCard"],
    " ",
    ["attr", "plan"],
    "=",
    ["string", '"taster"'],
    " ",
    ["attr", "padding"],
    "={",
    ["number", "24"],
    "} />",
  ],
  ["    </", ["type", "Page"], ">"],
  ["  ),"],
  ["});"],
];

/** The 1-based lines of the PriceCard that the wire joins to the card. */
export const WIRED_LINES: readonly number[] = [11, 12, 13, 14, 15, 17];
