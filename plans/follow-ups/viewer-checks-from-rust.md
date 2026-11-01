# Run the Rust read-model checks in the viewer

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the user chose option F of the viewer investigation as a follow-up.
- **Location:** `packages/viewer/src/catalogue/`, `packages/viewer/src/components/`, `packages/viewer/src/navigation/logical.ts`, `packages/viewer/src/data/`, `packages/viewer/src/data.ts`, `crates/mokly-model/src/readers.rs`, `crates/mokly-model/src/validation.rs`, and `crates/mokly-model/src/profile.rs`.
- **Reason:** On 2026-11-01 the user chose to remove the viewer's leftover layers first, and to share the Rust checks with the viewer after that change.

- **Source:** Design.
- **Category:** Code structure.
- **Terms:**
  - **Read model:** the JSON that the Rust core writes for the viewer:
    `mokly-viewer/index.json` and one entry detail file for each entry.
  - **React host:** an app, such as Mokly Cloud, that renders the
    `MoklyViewer` component inside its own page and supplies the read model.
  - **wasm2js:** a tool of the Binaryen WebAssembly toolkit. It converts a
    WebAssembly module into one plain JavaScript file with the same behaviour.
  - **Prop schema profile:** the strict JSON Schema subset that every
    component prop schema follows, in `docs/protocol/mokly-entry-props.md`.
- **Background:**
  - The Rust core checks the index and each entry detail before it writes
    them, with `crates/mokly-model/src/readers.rs`, `public_validation.rs`,
    `detail_validation.rs`, and `detail_context.rs`.
  - The viewer checks the same JSON again with hand-written TypeScript, about
    3,500 lines in `packages/viewer/src/catalogue/`, `components/`, and
    `navigation/`. `docs/protocol/mokly-viewer.md` requires a check in the
    viewer, because React hosts pass JSON that Rust did not write.
  - `@mokly/mokly` imports the path grammar and the prop schema checks from
    `@mokly/viewer/data`, in `packages/mokly/src/authoring/components.ts`,
    `authoring/links.ts`, and `sidecar/session.ts`.
  - On 2026-11-01 these TypeScript readers, validators, and grammars took
    about 49 KiB of the minified `shell.js`.
  - The Rust readers use `serde_json`, `jsonschema`, `url`, and
    `icu_collator` with its data, as `crates/mokly-model/Cargo.toml` lists.
  - Both content security policies of Mokly Cloud block WebAssembly on
    2026-11-01: `infra/docker/app-server.mjs:38-46` and
    `crates/mkc-catalogue-server/src/response.rs:205` of the
    `mokly-ai/mokly-cloud` repository. A `.wasm` module needs a policy change
    in each such host. JavaScript from wasm2js needs none.
  - Many Rust read-model types deny unknown fields, for example
    `crates/mokly-model/src/public_metadata.rs:8`, but the viewer must ignore
    them. A shared reader needs a strict mode for the core and a lenient mode
    for the viewer.
  - The Rust index reader checks no control options, in
    `crates/mokly-model/src/public_validation.rs:196-242`, so a shared reader
    alone does not fix the repeated options of
    `plans/follow-ups/derived-select-option-repeats.md`.
- **Problem:** Two hand-written implementations of the same checks drift.
  The investigation of 2026-11-01 found these differences:
  - The viewer rejects a schema property named `__proto__`, `constructor`,
    or `prototype`, in `packages/viewer/src/components/data.ts:41`. Rust
    turns that check off for schemas, in
    `crates/mokly-model/src/validation.rs:43`, but it rejects every props
    object with such a key, at `:81`. So under the Rust rule such a property
    never gets a value, and a shared reader alone does not choose the rule.
  - A repeated `enum` or `oneOf` value gives repeated select options in Rust,
    in `crates/mokly-model/src/controls.rs:80-100`. The viewer rejects
    repeated options, in `packages/viewer/src/components/controls.ts:104`.
  - Rust rejects a title with leading or trailing spaces. The viewer rejects
    only a blank title.
  - The viewer skips the view-axes rule for removed entries. Rust applies it.
  - The viewer ignores letter case in a stylesheet path. Rust does not.
  - `docs/protocol/mokly-component-props.md:95-96` says that the wrapper,
    the viewer, and the core apply the same profile.
- **Impact if no action:** A schema or a title that Rust accepts can make the
  whole catalogue unreadable in every viewer, with no error at build time.
  Each new rule needs a Rust change and a TypeScript change.
- **Root question:** How does the viewer check the read model with the same
  code as the Rust core?
- **Options:** The letters follow the investigation's options.
  - **A.** Change nothing, and keep two implementations. Effort: Small.
  - **D.** Compile the Rust readers, checks, and grammars to WebAssembly for
    the viewer and `@mokly/mokly`. Each host with a content security policy
    must allow `'wasm-unsafe-eval'`, and the viewer starts asynchronously.
    Effort: Large.
  - **E.** Extend `cargo xtask generate-types` so that it also writes the
    TypeScript readers. Checks across several fields stay hand-written.
    Effort: Large.
  - **F.** Compile the same Rust code to WebAssembly, then convert it to plain
    JavaScript with wasm2js. No host changes its policy, and the code loads
    synchronously. The file is larger and slower than WebAssembly, and it is
    hard to debug. Each build needs the Rust WebAssembly target,
    `wasm-bindgen-cli`, and Binaryen. Effort: Large.
  - **G.** Check the read model once, with the Rust readers, where it enters:
    the core when it writes, and Mokly Cloud when it receives an upload. The
    viewer keeps only the version gates and the fences. It changes
    `docs/protocol/mokly-viewer.md:44-45`,
    `docs/protocol/mokly-catalogue-serialization.md:101-104`, and
    `docs/protocol/mokly-upload-validation.md`, and JSON that no Rust reader
    checked can then break the viewer. Effort: Large.
  - **H.** Make the TypeScript readers the one implementation, and run them in
    the core through the Node sidecar, which already loads
    `@mokly/viewer/data`. It needs no WebAssembly toolchain and adds no bundle
    size, but every core check then crosses the sidecar boundary, against
    `docs/protocol/mokly-sidecar.md:5-9` and `:19-20`. Effort: Large.
- **Left out:**
  - Trust the JSON: it breaks the check requirement of `mokly-viewer.md`,
    whose reason holds, because Mokly Cloud renders uploaded JSON.
  - Translate the Rust source into readable TypeScript: no tool does this for
    crates such as `serde_json` and `jsonschema`, and a hand port is a second
    copy again.
- **Wider fix:** F, D, or H, because one implementation of each check cannot
  drift. They cover the checks only. Copies of derivations stay, for example
  `packages/viewer/src/shell/catalogue_branch_point.ts:88-152` beside
  `crates/mokly-compare/src/lookup.rs:111-241`.
- **Previous examples:**
  - Default 12 C of the Rust rebuild plan, of 2026-10-20, kept the
    TypeScript prop schema checks for the sidecar and chose no WebAssembly
    validator.
  - `plans/follow-ups/reserved-navigation-names-in-authored-html.md` holds
    the saved-slot reserved-name check, another
    reserved-name check that differs between two places.
- **Related:** `plans/follow-ups/derived-select-option-repeats.md`: a
  shared reader does not fix the repeated options.
- **Recommendation:** F. Start with a measured trial. Build the readers for
  `wasm32-unknown-unknown`, run `wasm-opt -Oz` and wasm2js, and compare the
  gzip size and the parse time of the large fixture's index with the
  TypeScript readers. Measure H as well. Bring the numbers to the user before
  the switch when the cost is large.
- **Action:** fix after merge, apply F, because the user chose F on
  2026-11-01 as the follow-up of the leftover-layer change. On the same day
  the user chose to leave the two schema differences unchanged until F.
