/**
 * Documents and usage ranges that `mokly serve` answered for the HTML fixture
 * catalogue (crates/mokly-graph/tests/fixtures/catalogue), captured verbatim:
 * the mobile light view of the screen `home` and of the component
 * `components/button`.
 */

import type { CatalogueUsage } from "../src/catalogue/types.js";

type Ranges = Extract<CatalogueUsage, { status: "ready" }>["ranges"];

/** Three instances, owner-supplied slots, and a slot instance placed twice. */
export const HOME_BODY = `
<main>
  <h1 id="home">&lt;Save &amp; &quot;go&quot;&gt;</h1>
  <p title="prefix &lt;Save &amp; &quot;go&quot;&gt; suffix">Ready {{unclosed</p>
  <p>Mobile</p>
  
  <!--mokly-instance:start id="r-0" path="components/button" instance="9044717ea526e19b0b3e5da83922479062ae2b472f527709917678cc6822e238" props="1b94138bad2e15340d2a007100f64db788cbb51958acb8f806de9ea7e3998e14"-->
<button class="button" aria-label="&lt;Save &amp; &quot;go&quot;&gt;" title="Ready">
  &lt;Save &amp; &quot;go&quot;&gt; <i>3</i> <small>Default</small>
</button>
<!--mokly-instance:end id="r-0"-->
  <!--mokly-instance:start id="r-1" path="components/button" instance="cf89b04d6de5f189ee02caae7f6f29ae566238380e6af444aa4515ce0f3a13c0" props="29f8f06e3fd4eaab1d7917c6babec5ff86a2c296b2231a2c07de53762d326903"-->
<button class="button" aria-label="$literal">
  $literal <i>4</i> <small>Default</small>
</button>
<!--mokly-instance:end id="r-1"-->
  
    <!--mokly-instance:start id="r-2" path="components/card" instance="04d18a64e115b0260147c48d798a705df2b16127a80ffc765bced9f28e09ad0f" props="c7ac45b123ec923b20307b19bcf1e04b95f29614a7606524acce3689ee2f3d0e"-->
<article>
  <h2>Details</h2>
  
  <!--mokly-slot:start id="r-3" name="header"--><strong>Supplier &lt;Save &amp; &quot;go&quot;&gt;</strong><!--mokly-slot:end id="r-3"-->
  <time>Now</time><!--mokly-slot:start id="r-4" name="children"-->
      
      <span>Supplied text</span>
      <!--mokly-instance:start id="r-5" path="components/button" instance="feb92f82bf38485d98b5b0912c7fec31c3eda4283d80ea4ade27c33e09577d84" props="7e5585a3f92753a3747c8485d191b5ecfaa40324846f5c9bd1dedcb8afeac23b"-->
<button class="button" aria-label="Slot action">
  Slot action <i></i> <small>Default</small>
</button>
<!--mokly-instance:end id="r-5"-->
    <!--mokly-slot:end id="r-4"--><!--mokly-slot:start id="r-6" name="children"-->
      
      <span>Supplied text</span>
      <!--mokly-instance:start id="r-7" path="components/button" instance="feb92f82bf38485d98b5b0912c7fec31c3eda4283d80ea4ade27c33e09577d84" props="7e5585a3f92753a3747c8485d191b5ecfaa40324846f5c9bd1dedcb8afeac23b"-->
<button class="button" aria-label="Slot action">
  Slot action <i></i> <small>Default</small>
</button>
<!--mokly-instance:end id="r-7"-->
    <!--mokly-slot:end id="r-6"-->
</article>
<!--mokly-instance:end id="r-2"-->
  
  <time>Today</time>
  <a href="../guide/index.html#guide" data-mokly-link="guide#guide">Guide</a>
  <a class="card" href="../page/index.html#summary" data-mokly-link-control="div" data-mokly-link="page#summary">Statement</a>
  <button disabled="" data-nav-href="../page/index.html" type="button">Inactive</button>
  <img src="../../specs/assets/public.svg" alt="Public">
</main>
`;

export const HOME_RANGES: Ranges = [
  {
    id: "r-0",
    target: {
      instanceKey:
        "9044717ea526e19b0b3e5da83922479062ae2b472f527709917678cc6822e238",
      kind: "instance",
    },
  },
  {
    id: "r-1",
    target: {
      instanceKey:
        "cf89b04d6de5f189ee02caae7f6f29ae566238380e6af444aa4515ce0f3a13c0",
      kind: "instance",
    },
  },
  {
    id: "r-2",
    target: {
      instanceKey:
        "04d18a64e115b0260147c48d798a705df2b16127a80ffc765bced9f28e09ad0f",
      kind: "instance",
    },
  },
  {
    id: "r-3",
    parentId: "r-2",
    target: {
      kind: "slot",
      slotKey:
        "62622ea8ea81fa887a80fed8323b0fa23cfd501d47cfb5f81915d3373168e275",
    },
  },
  {
    id: "r-4",
    parentId: "r-2",
    target: {
      kind: "slot",
      slotKey:
        "a52a8e6bd517dc1186c748d998d0ec871fdfb54a0a2c84da6503d68701120ce1",
    },
  },
  {
    id: "r-5",
    parentId: "r-4",
    target: {
      instanceKey:
        "feb92f82bf38485d98b5b0912c7fec31c3eda4283d80ea4ade27c33e09577d84",
      kind: "instance",
    },
  },
  {
    id: "r-6",
    parentId: "r-2",
    target: {
      kind: "slot",
      slotKey:
        "a52a8e6bd517dc1186c748d998d0ec871fdfb54a0a2c84da6503d68701120ce1",
    },
  },
  {
    id: "r-7",
    parentId: "r-6",
    target: {
      instanceKey:
        "feb92f82bf38485d98b5b0912c7fec31c3eda4283d80ea4ade27c33e09577d84",
      kind: "instance",
    },
  },
];

/** A component page: the root component renders the body, with no marker. */
export const BUTTON_BODY = `
<button class="button" aria-label="Save" title="New">
  Save <i>2</i> <small>Default</small>
</button>
`;

export const BUTTON_RANGES: Ranges = [{ id: "r-0", target: { kind: "root" } }];
