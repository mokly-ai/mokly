# Decisions of the viewer checks change

This file holds decision 1 of [the plan](../viewer-checks-from-rust.md) in
full. [rule-differences.md](./rule-differences.md) holds decision 2. Both wait
for the user. The options check of 2026-11-02 added the
options with the letters after the trial's letters, and it changed both
recommendations. Its summary is in
`.context/viewer-checks-from-rust/options-check.md`. The pull request of the
plan deletes this file with the plan.

**Terms**

- **Read model:** the JSON that the Rust core writes for the viewer:
  `mokly-viewer/index.json` and one entry detail file for each entry.
- **wasm2js:** a tool of the Binaryen WebAssembly toolkit. It converts a
  WebAssembly module into one plain JavaScript file with the same behaviour.
- **Slim reader:** the Rust readers without the `jsonschema` crate, with a
  hand-written validator of the prop schema profile and a direct decode from
  JSON text.
- **Standalone shell:** the Browse shell that Serve and the static build
  deliver as `mokly-viewer/client/shell.js`, from the `./browser` entry.
- **Embedded entry:** the root React entry of `@mokly/viewer`. A React host,
  such as Mokly Cloud, renders it with JSON that the host supplies.
- **Wrapper:** the `defineComponent` wrapper of `@mokly/mokly`. It checks the
  props of each component render in the sidecar.
- **Large fixture:** the synthetic HTML catalogue of `tests/fixtures/large`
  with default dimensions: a 3.8 MB index and 1,620 entry details.

## 1. The trial shows a large cost for option F

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-model/src/validation.rs`,
  `crates/mokly-model/src/readers.rs`, `packages/viewer/src/catalogue/`,
  `packages/viewer/src/components/`, and
  `packages/mokly/src/authoring/components.ts`.
- **Background:**
  - On 2026-11-01 the user chose option F: compile the Rust readers to
    WebAssembly, then convert them to JavaScript with wasm2js. The user asked
    for a measured trial first, and for the numbers before the switch when
    the cost is large.
  - The trial ran on 2026-11-02, on stable Rust 1.95 with Binaryen 132.
  - Today the TypeScript readers, validators, and grammar take 45 KB of
    minified code, 15 KB gzip. The whole `shell.js` is 547 KB, 171 KB gzip.
  - The as-is readers became 4.7 MB of minified JavaScript, 1.25 MB gzip.
    Chrome read the large index in 26 s. TypeScript takes 131 to 151 ms.
  - The as-is build needs two patches, for the SIMD code of `bytecount` and
    for the backend of `getrandom`. Both come from `jsonschema`. On wasm,
    `jsonschema` also compiles its metaschema again for each schema.
  - The slim reader became 1.39 MB of minified JavaScript, 365 KB gzip.
    Chrome loaded it in 43 to 49 ms, against 15 to 16 ms today. Chrome read
    the large index in 620 to 790 ms.
  - In Node, the slim reader read the 1,620 large details in 2,245 ms.
    TypeScript takes 1,245 ms.
  - The slim reader as WebAssembly is 682 KB, 255 KB gzip. In Node it read
    the large index in 87 ms, against 171 ms for TypeScript. The trial did
    not measure WebAssembly in Chrome.
  - Each timed read includes the Rust encode of the result and its parse in
    JavaScript. The slim numbers are a lower bound: the trial used a stub
    validator, no known-field comparison, and no privacy walk.
  - Chrome 115 and later compile a WebAssembly module of up to 8 MB
    synchronously on the main thread.
  - The core already runs its readers on the bytes that it writes, in
    `crates/mokly-static/src/assembly.rs:221-233`,
    `crates/mokly-server/src/snapshot.rs:267`, and
    `crates/mokly-server/src/detail_encoding.rs:38`.
  - All options share these assumptions:
    - Each viewer delivery checks each document that it reads. Source:
      `docs/protocol/mokly-viewer.md:44-45`. Its reason is JSON that Rust did
      not write. The reason holds for the embedded entry only. G and M drop
      the assumption.
    - No host changes its content security policy. Source: the text of
      option F. Both policies of Mokly Cloud block WebAssembly today. D, K,
      and L drop it.
    - An object index reads synchronously. Source: the code,
      `packages/viewer/src/catalogue/sources.ts:153`. D and K drop it.
    - The wrapper checks props before its adapter runs. Source:
      `docs/protocol/mokly-component-props.md:91-93`. Its reason holds. No
      option drops it.
- **Problem:** Option F as chosen makes the shell about eight times larger
  and the large index read about 180 times slower. The slim reader as wasm2js
  still makes the shell about three times larger. Its first index read in
  Chrome takes four to six times as long as today.
- **Impact if no action:** F as chosen makes large catalogues unusable in
  every viewer. Without one implementation, the two copies of the checks keep
  drifting.
- **Root question:** How does one set of read-model and prop-schema rules
  govern every document that a viewer shows and every prop that the wrapper
  renders, at a cost that the viewer can carry? The options check widened the
  first question, which had each place run the rules itself.
- **Options:** The letters A to H follow the follow-up item. The trial added
  I, J, and K. The options check added L, M, and N.
  - **A.** Change nothing, and keep two implementations. Effort: Small.
  - **D.** Ship the slim reader as a `.wasm` file. It adds about 240 KB
    gzip, and its reads in Node were faster than today's. Each host with a
    content security policy must allow `'wasm-unsafe-eval'`. A `.wasm` file
    compiles asynchronously, so an object index waits for it. Effort: Large.
  - **E.** Extend `cargo xtask generate-types` so that it also writes the
    TypeScript readers. Checks across several fields stay hand-written in
    both languages. Effort: Large.
  - **F.** Convert the as-is readers with wasm2js, as chosen on 2026-11-01.
    It adds about 1.23 MB gzip. The large index takes 26 s in Chrome.
    Effort: Large.
  - **G.** Check the read model once, with the Rust readers, where it
    enters: the core when it writes, and Mokly Cloud when it receives an
    upload. The viewer keeps only the version gates and the fences.
    - Mokly Cloud checks no index or detail today. Its contract crate,
      `mkc-mokly-contract`, takes no dependency on Mokly crates. So Cloud
      must depend on `mokly-model`, which is not published, or copy its
      rules.
    - JSON that no Rust reader checked can throw while the embedded entry
      renders. The viewer has no error boundary, so the error reaches the
      host's own boundary, or React unmounts the host's root.
    - The wrapper keeps the TypeScript prop-schema checks of `./data`, so
      the profile rules keep two copies.
    - It changes `docs/protocol/mokly-viewer.md`,
      `docs/protocol/mokly-catalogue-serialization.md`, and
      `docs/protocol/mokly-upload-validation.md`. Effort: Large.
  - **H.** Make the TypeScript readers the one implementation, and run them
    in the core through the Node sidecar. They take about 1.5 s for the large
    fixture in Node. Every catalogue then starts a sidecar, also one without
    JavaScript, against `docs/protocol/mokly-sidecar.md`. Effort: Large.
  - **I.** Convert the slim reader with wasm2js for every delivery.
    `mokly-model` drops `jsonschema`, so the core uses the same validator. It
    adds about 350 KB gzip to `shell.js` and to the embedded entry. No host
    changes its policy, and an object index reads synchronously. The in-frame
    inspector keeps its own entry-path check, because its bundle has a
    9,216-byte budget. Effort: Large.
  - **J.** Keep both implementations. Align them to one rule set, and run
    one shared set of valid and invalid cases through both test suites. It
    costs nothing at run time. A new rule still needs two changes, and drift
    stays possible where no case covers it. Effort: Medium.
  - **K.** Ship the slim reader both ways: a `.wasm` file where the host
    allows it, and the wasm2js file where it does not. The viewer loads one
    of them at start, so it starts asynchronously. Two delivery paths need
    builds and tests. Effort: Large.
  - **L.** Ship the slim reader as WebAssembly bytes inside `shell.js` and
    the embedded entry, and compile them with `new WebAssembly.Module`. An
    object index still reads synchronously, and reads run at WebAssembly
    speed. Each host with a content security policy must still allow
    `'wasm-unsafe-eval'`. The inline bytes add more than the 240 KB gzip of
    D. Effort: Large.
  - **M.** Check only where JSON that Rust did not write enters. The
    standalone shell keeps only the version gates, the revision and
    `detailId` fences, and its URL path grammar, with a parity test against
    the Rust side. The embedded entry and the wrapper use the slim reader as
    wasm2js, as in I. Serve's live prop edits load the validator as a module
    that only Serve requests. `shell.js` gets smaller than today, and only
    the embedded entry carries the cost of I. It changes
    `docs/protocol/mokly-viewer.md:44-45`, and the standalone shell stops
    running checks that it runs today. Effort: Large.
  - **N.** Make the TypeScript readers the one implementation, and run them
    inside the core with an embedded JavaScript engine, such as QuickJS. No
    sidecar starts, and the viewer keeps its size and speed. The engine adds
    C code to each of the five native builds. An interpreter without a JIT
    compiler runs the checks many times slower than Node. Effort: Large.
- **Left out:**
  - Trust the JSON everywhere: it breaks the check requirement for the
    embedded entry, whose reason holds, because Mokly Cloud renders uploaded
    JSON. M trusts only the standalone shell, where the reason is gone.
  - Translate the Rust source into readable TypeScript: no tool does this
    for crates such as `serde_json`, and a hand port is a second copy again.
  - Load the module after the first render: the catalogue still waits for
    the check, so this is a detail of how I or M split the bundle.
  - A rule language that generates both the Rust and the TypeScript checks:
    a language that can express the fences, the usage keys, and the tree
    rules becomes a third programming language.
  - A worker thread for the check: the catalogue still waits for the check,
    so the size and the time to content stay the same.
- **Wider fix:** Any option with one implementation: D, F, H, I, K, L, M, or
  N. M also removes the second run of the rules on bytes that the core
  already checked. J only detects drift where a case exists.
- **Previous examples:**
  - Default 12 C of the Rust rebuild plan, of 2026-10-20, kept the
    TypeScript prop schema checks for the sidecar and chose no WebAssembly
    validator.
  - `plans/follow-ups/reserved-navigation-names-in-authored-html.md` holds
    another check that differs between two places.
- **Related:** Decision 2 has the same cause. Its rules apply to every option
  except A.
- **Recommendation:** M, after the options check. The first recommendation
  was I.
  - Under I, every Serve and static catalogue loads at least 350 KB more
    gzip. It runs the checks again on bytes that the core already checked,
    and that adds no protection.
  - M keeps one implementation wherever the rules run. It needs no host
    policy change and keeps the synchronous object read.
  - D or L in the embedded entry best protects its load speed, if every
    React host may allow `'wasm-unsafe-eval'`.
- **Action:** ask the user, because the trial cost is large, and the user
  asked to see the numbers before the switch.
