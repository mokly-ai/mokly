/**
 * The code of the Your first screen guide as syntax tokens, word for word
 * from the guide's fences: the HTML sample file, the React screen and the
 * shell commands.
 */

import type { CodeLine } from "./code_panel.js";

/** `specs/welcome.screen.html`, the guide's first fence and its sample. */
export const WELCOME_SCREEN: readonly CodeLine[] = [
  [["punct", "---"]],
  [["punct", "title"], ": ", ["string", "Welcome"]],
  [
    ["punct", "description"],
    ": ",
    ["string", "The first screen after sign-in."],
  ],
  [
    ["punct", "props"],
    ": { ",
    ["punct", "name"],
    ": ",
    ["string", "Ada"],
    ", ",
    ["punct", "returning"],
    ": ",
    ["number", "true"],
    " }",
  ],
  [["punct", "variants"], ":"],
  ["  - ", ["punct", "slug"], ": ", ["string", "first-visit"]],
  ["    ", ["punct", "title"], ": ", ["string", "First visit"]],
  [
    "    ",
    ["punct", "props"],
    ": { ",
    ["punct", "returning"],
    ": ",
    ["number", "false"],
    " }",
  ],
  [["punct", "---"]],
  [],
  ["<", ["type", "main"], ">"],
  [
    "  <",
    ["type", "h1"],
    ">Welcome, ",
    ["keyword", "{{name}}"],
    "</",
    ["type", "h1"],
    ">",
  ],
  [
    "  <",
    ["type", "p"],
    " ",
    ["attr", "mokly-if"],
    "=",
    ["string", '"$returning"'],
    ">Your workspace is ready.</",
    ["type", "p"],
    ">",
  ],
  [
    "  <",
    ["type", "p"],
    " ",
    ["attr", "mokly-viewport"],
    "=",
    ["string", '"mobile"'],
    ">Compact navigation</",
    ["type", "p"],
    ">",
  ],
  [
    "  <",
    ["type", "p"],
    " ",
    ["attr", "mokly-viewport"],
    "=",
    ["string", '"desktop"'],
    ">Full navigation</",
    ["type", "p"],
    ">",
  ],
  ["</", ["type", "main"], ">"],
];

/** `specs/account/account-home.mockup.tsx`, the React screen. */
export const ACCOUNT_HOME_SCREEN: readonly CodeLine[] = [
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
  [["keyword", "export default"], " ", ["fn", "defineScreen"], "({"],
  ["  ", ["punct", "title"], ": ", ["string", '"Account home"'], ","],
  [
    "  ",
    ["punct", "description"],
    ": ",
    ["string", '"The account landing screen."'],
    ",",
  ],
  ["  ", ["punct", "relatedDocs"], ": [],"],
  [
    "  ",
    ["punct", "props"],
    ": { ",
    ["punct", "name"],
    ": ",
    ["string", '"Sam"'],
    " },",
  ],
  [
    "  ",
    ["punct", "render"],
    ": (props) ",
    ["keyword", "=>"],
    " <",
    ["type", "main"],
    ">Hello, {props.",
    ["punct", "name"],
    "}</",
    ["type", "main"],
    ">,",
  ],
  ["});"],
];

/** `npx mokly build --strict --no-changes`, which validates the catalogue. */
export const VALIDATE: CodeLine = [
  ["fn", "npx"],
  " ",
  ["type", "mokly"],
  " ",
  ["keyword", "build"],
  " ",
  ["attr", "--strict"],
  " ",
  ["attr", "--no-changes"],
];

/** `npx mokly serve`, which opens the catalogue. */
export const SERVE: CodeLine = [
  ["fn", "npx"],
  " ",
  ["type", "mokly"],
  " ",
  ["keyword", "serve"],
];

/** `npx mokly build --out mokly-static`, the static build. */
export const BUILD_OUT: CodeLine = [
  ["fn", "npx"],
  " ",
  ["type", "mokly"],
  " ",
  ["keyword", "build"],
  " ",
  ["attr", "--out"],
  " ",
  ["string", "mokly-static"],
];
