# Design calls of the viewer checks change

This file holds my design calls for [the plan](../viewer-checks-from-rust.md),
made on 2026-11-02. They hold under option M of
[decision 1](./decisions.md#1-the-trial-shows-a-large-cost-for-option-f) and
option D of
[decision 2](./decisions.md#2-the-core-and-the-viewer-apply-different-rules).
The pull request of the plan deletes this file with the plan.

1. No wasm-bindgen. The module has a small C ABI with JSON text in and out,
   and a TypeScript wrapper marshals the text. Once `jsonschema` goes, no
   dependency needs wasm-bindgen, and its CLI must match the crate version
   exactly.
2. Binaryen comes from the exact-pinned `binaryen` npm package, which runs
   `wasm-opt` and `wasm2js` under Node on every platform. `npm ci` installs
   it with no native download. It unpacks to 108 MB.
3. The module is built, never committed. `cargo xtask build-model-js` runs in
   `npm run build` after `build-native`, and the viewer build copies the
   file into `dist`. A generated 1.4 MB file in Git churns with each model
   change, and the length and lint audits cover committed JavaScript.
4. A new crate, `mokly-model-js`, holds the ABI, the handle tables, and the
   JSON envelopes. `mokly-model` stays free of `unsafe` code and of the
   WebAssembly target.
5. Each tagged union decodes through a raw record that rejects the fields of
   its other variants, in both modes. The strict mode keeps the re-encode
   comparison for unknown fields, and the lenient mode skips it. The privacy
   walk runs in both modes. The `deny_unknown_fields` attributes go, because
   the comparison already rejects unknown fields in the strict mode.
6. Each rule has one role under option D of decision 2: writer-only, or
   needed by every reader. The strict mode runs every rule. The lenient mode
   runs only the rules that every reader needs. Milestone 2 gives each rule
   its role.
7. The module keeps each installed index, with its compiled schemas, behind
   a handle. The embedded entry frees the handle when it replaces the index
   or unmounts. A `FinalizationRegistry` frees a handle that it missed. A
   fence needs the index, and the large index is 3.8 MB.
8. The fence outcomes accepted, revision, deployment, and rejected move into
   `mokly-model`, for current and removed details. The core's
   `detail_context::validate` maps every outcome except accepted to its
   current error. The standalone shell keeps a TypeScript delivery fence of
   revision, `detailId`, and identity, with a parity test against the Rust
   fence over the shared cases.
9. The embedded entry reads a URL source as text and passes the text to the
   module. An object source passes the TypeScript plain-data guard, then
   `JSON.stringify`. JSON text carries no getters, prototypes, or symbols,
   so that guard is not a read-model rule.
10. `readCatalogueIndex`, `readEntryDetail`, `MoklyVersionError`, and the
    `./data` exports keep their names and signatures. They are entries of a
    published package, and the public export ratchet checks them.
11. The new validator writes the message texts of the `jsonschema`
    diagnostics that the core prints today. Terminal output stays the same.
12. The shared cases of Milestone 2 become the Rust tests of both modes, a
    Node test of the built module, and the parity tests. They prove that the
    wasm2js build gives the native result.
13. The embedded entry and the validators of `./data` import the module.
    `shell.js` does not. Serve's live prop edits load it as a browser module
    that only Serve requests, and the static output does not copy it.
14. Node uses the same wasm2js file. Milestone 10 measures the wrapper. A
    `.wasm` build for Node stays a later option for when that cost is large.
15. The path, link, and fragment grammar stays in one TypeScript module,
    `packages/viewer/src/navigation/logical.ts`, with a parity test against
    the Rust grammar. The standalone shell, the in-frame inspector, and the
    grammar of `./data` use it. A 1.4 MB module for a few regular
    expressions costs too much in the inspector and in hosts.
16. A stylesheet path has the core's meaning: the case-sensitive suffix
    `.css`. The core classifies each file when it writes the read model, so a
    reader must use the same meaning.
