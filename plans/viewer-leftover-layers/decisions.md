# Decisions of the viewer leftover-layer change

This file holds the user decisions of
[the plan](../viewer-leftover-layers.md) in full. The user answered all three
on 2026-11-01. The options check of the same day added the options with the
letters after the recorded ones. Its summary is in
`.context/viewer-leftover-layers/options-check.md`. The plan's pull request
deletes this file with the plan.

**Terms**

- **Read model:** the JSON that Rust writes for the viewer:
  `mokly-viewer/index.json` and one entry detail file for each entry.
- **React host:** an app, such as Mokly Cloud, that renders the `MoklyViewer`
  component inside its own page and supplies the read model.
- **CSP:** Content Security Policy, an HTTP header in which a site lists the
  code that its pages may run.

## 1. The viewer repeats rules that Rust owns

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `packages/viewer/src`, mainly `viewer/projection.ts`,
  `registry/`, `catalogue/`, and `components/`.
- **Terms:**
  - **Old manifest model:** the data shapes of the replaced TypeScript
    backend, such as `ManifestEntry` and the `live-index-2` manifest.
  - **wasm2js:** a tool of the Binaryen WebAssembly toolkit that converts a
    WebAssembly module into one plain JavaScript file.
- **Background:**
  - The viewer has about 33,000 lines. About 22,400 of them are browser work.
  - The Rust rebuild of PR #199 kept the viewer and only made it read the new
    JSON. The `@mokly/ui` plans moved the markup and kept the store design.
  - Rust already has most of the repeated rules, for example the branch-point
    lookup in `crates/mokly-compare/src/lookup.rs`.
  - All options assume three things. The shell renders in the browser, by
    user decision 21 of 2026-10-13. The viewer checks the JSON that it reads,
    as `docs/protocol/mokly-viewer.md` requires. The UI stays in `@mokly/ui`,
    by the user's decision of 2026-10-27.
- **Problem:** About 8,600 lines repeat Rust rules or convert the read model
  to the old manifest model. When one rule has two copies, the copies drift.
- **Impact if no action:** Each change to a catalogue rule needs a Rust change
  and a TypeScript change, and the copies keep drifting.
- **Root question:** How can the viewer hold only browser work, with each
  catalogue rule written once?
- **Options:**
  - **A.** Change nothing, and add a map of the viewer's parts to its README.
    Effort: Small.
  - **B.** Remove the leftover layers and keep the JSON formats. The shell
    reads the generated types and uses the values that Rust writes. No
    protocol change. Effort: Large.
  - **C.** B, then Rust writes the two navigation sections, the parent of each
    removed variant, and the related components of each view. Index v10 and
    detail v5, six protocol pages, and a Mokly Cloud update. Effort: Large.
  - **D.** B, then the Rust readers, checks, and grammars run in the browser
    as WebAssembly. Each host with a CSP must allow `'wasm-unsafe-eval'`, and
    both policies of Mokly Cloud block WebAssembly today. Effort: Large.
  - **E.** B, then `cargo xtask generate-types` also writes the TypeScript
    readers. Checks across several fields stay hand-written. Effort: Large.
  - **F.** B, then the Rust code of D, converted to plain JavaScript with
    wasm2js. No CSP change, but the file is larger and slower than in D.
    Effort: Large.
  - **G.** B, then the Rust readers check the read model once, where it
    enters: the core when it writes, and Mokly Cloud when it receives an
    upload. The viewer keeps only the version gates and the fences. It
    changes `mokly-viewer.md:44-45`, `mokly-catalogue-serialization.md:101-104`,
    and `mokly-upload-validation.md`, and JSON that no Rust reader checked can
    then break the viewer. Effort: Large.
  - **H.** B, then the TypeScript readers become the one implementation, and
    the core runs them in the Node sidecar. It needs no WebAssembly toolchain,
    but every core check crosses the sidecar boundary, against
    `docs/protocol/mokly-sidecar.md:5-9` and `:19-20`. Effort: Large.
- **Left out:**
  - Trust the JSON: it breaks the check requirement of `mokly-viewer.md`,
    whose reason holds, because Mokly Cloud renders uploaded JSON.
  - Render the shell in Rust: it reverses user decision 21, and frames,
    comparison, and inspection still need browser code.
  - Keep the shell state in Rust compiled for the browser: it fails the goal,
    because the shell state has no Rust copy to remove.
  - One shared case table that the Rust and TypeScript tests both run, as
    `tests/fixtures/branch_point_cases.json` does: it fails the goal, because
    both copies stay.
  - Translate the Rust source into readable TypeScript: no tool does this for
    these crates, and a hand port is a second copy again.
  - Remove features: it fails the goal of the same product with a thinner
    viewer.
  - Move code into `@mokly/ui`: it removes no lines, and the package may not
    read catalogue types.
- **Wider fix:** D, F, or H, for the checks only. Copies of derivations stay,
  for example `shell/catalogue_branch_point.ts:88-152` beside
  `crates/mokly-compare/src/lookup.rs:111-241`. C removes some of them.
- **Previous examples:** Default 12 C of the Rust rebuild plan, of
  2026-10-20, kept the TypeScript prop schema checks for the sidecar and chose
  no WebAssembly validator.
- **Related:** Decisions 2 and 3 have the same cause, two copies of one rule.
- **Recommendation:** C was the first recommendation. The options check
  recommends B now and F after its measured trial, as the user chose, because
  the drift that the investigation found is in the checks. The trial also
  measures H.
- **Action:** The user chose B now and F as a follow-up, on 2026-11-01. This
  plan applies B. `plans/follow-ups/viewer-checks-from-rust.md` holds F.

## 2. The removed-preview fetch breaks the fetch rule

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Small.
- **Source:** Review.
- **Category:** Product bug.
- **Location:** `packages/viewer/src/previews/request.ts:160-163`.
- **Background:** A removed entry shows its previous version from the
  comparison files. The index, detail, and deployment fetches use `fetchJson`
  in `packages/viewer/src/viewer/sources.ts:62`. That helper sends no
  credentials, and it rejects another origin or another content type.
- **Problem:** `requestPreview` calls `fetch` with an `accept` header and the
  default credentials. It accepts a redirect to another origin and any
  content type. `docs/protocol/mokly-shell-fences.md:49-51` forbids all three.
- **Impact if no action:** These requests send the cookies of the catalogue
  origin, and a redirect can supply JSON from another origin.
- **Root question:** How does each read-model file that the viewer reads meet
  the shell fetch rule and the shell fences? The options check widened the
  first question, because the preview's own read also skips the fence.
- **Options:**
  - **A.** Send `requestPreview` through `fetchJson`. Effort: Small.
  - **B.** Copy the three checks into `requestPreview`. Effort: Small.
  - **C.** Change nothing, and edit the protocol to allow this fetch. Effort:
    Small.
  - **D.** Show a removed screen's preview from the removed detail that the
    route already loads and fences, in `shell/data_requests.ts:45-54`. It
    removes the second read, but it changes `mokly-removed-previews.md:126-131`
    for embedded hosts. Effort: Medium.
  - **E.** A, and one credential rule for every viewer request, also the live
    comparison and live render requests. It edits
    `mokly-comparison-panes.md:27-29`. Effort: Medium.
- **Left out:** None. The options check brought back the one credential rule
  as E, because Serve reads no cookie, in
  `crates/mokly-server/src/security.rs:23-34`.
- **Wider fix:** D, because one read path applies the fetch rule and the
  fences to the removed detail. It changes a requirement, so
  `plans/follow-ups/removed-preview-detail-fence.md` holds it.
- **Previous examples:** None found.
- **Related:** Decision 1, same cause.
- **Recommendation:** A, also after the options check.
- **Action:** The user chose A on 2026-11-01. This plan applies it.
  `plans/follow-ups/viewer-credential-rule.md` holds E.

## 3. The viewer rejects schemas that Rust accepts

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Review.
- **Category:** Product bug.
- **Location:** `packages/viewer/src/components/data.ts:41`,
  `packages/viewer/src/components/controls.ts:104`,
  `crates/mokly-model/src/validation.rs:43`, and
  `crates/mokly-model/src/controls.rs:80-100`.
- **Background:** The core and the viewer check prop schemas with separate
  code. `docs/protocol/mokly-component-props.md:95-96` says that both apply
  the same rules. The viewer checks every schema of the index before it
  renders.
- **Problem:** A schema property named `__proto__`, `constructor`, or
  `prototype` fails in the viewer, but Rust turns that check off for schemas.
  A repeated `enum` or `oneOf` value gives repeated select options in Rust,
  and the viewer rejects repeated options.
- **Impact if no action:** Such a schema builds without an error, but no
  viewer opens the catalogue.
- **Root question:** Which prop schemas and derived controls does Mokly
  accept, the same way in the core, the wrapper, and the viewer? The options
  check widened the first question, because the wrapper checks schemas too,
  and the repeated options are derived controls.
- **Options:**
  - **A.** The core rejects both cases with a diagnostic that names the source
    file. This is a new build error. Effort: Small.
  - **B.** The viewer accepts both cases. Effort: Small.
  - **C.** Change nothing. Effort: Small.
  - **D.** The core derives each select option once. It keeps the first of
    repeated `enum` values, and it leaves out a repeated `oneOf` constant.
    `mokly-component-controls.md:48-49` already requires unique option
    values, and declared controls already reject repeats, in
    `crates/mokly-catalogue/src/declared_controls.rs:163-188`. It settles only
    the repeated options. Effort: Small.
- **Left out:** One shared validator stays out, because it must still accept
  or reject each case, so it does not answer the root question.
- **Wider fix:** Option F of decision 1 removes the drift between the
  validators, but it does not choose a rule. The Rust index reader checks no
  control options, in `crates/mokly-model/src/public_validation.rs:196-242`.
- **Previous examples:** `plans/follow-ups/saved-slot-reserved-metadata.md`.
- **Related:** Decision 1, same cause.
- **Recommendation:** A was the first recommendation. The options check
  recommends D for the repeated options, with A for the reserved names.
- **Action:** The user chose C on 2026-11-01, because option F of decision 1
  follows. C stays in force until the user answers again.
  `plans/follow-ups/derived-select-option-repeats.md` holds option D.
