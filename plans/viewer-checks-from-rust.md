# Run the core's read-model checks in the viewer

Status: Active. On branch `calummoore/rust-viewer-checks-plan`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. Decisions 1 and 2 wait for the user, and no milestone starts before the answers.

The core checks the read model with the Rust readers of `mokly-model` before
it writes it. The viewer checks the same JSON again with about 4,500 lines of
hand-written TypeScript, and `@mokly/mokly` uses the viewer's prop schema
checks in its component wrapper. The two copies drift: the investigation of
2026-11-01 and a code search of 2026-11-02 found eleven differences. On
2026-11-01 the user chose option F of that investigation: run the Rust checks
in the viewer as plain JavaScript that wasm2js makes from the Rust code, after
a measured trial. `plans/follow-ups/viewer-checks-from-rust.md` recorded the
choice.

The trial ran on 2026-11-02. The as-is readers cannot ship: they add about
1.23 MB gzip to the shell, and Chrome takes 26 s to read the large fixture's
index.
[Decision 1](./viewer-checks-from-rust/decisions.md#1-the-trial-shows-a-large-cost-for-option-f)
gives the numbers and the options.
[Decision 2](./viewer-checks-from-rust/rule-differences.md#2-the-core-and-the-viewer-apply-different-rules)
asks which rule applies where the two copies differ. The options check of
2026-11-02 added options to both and changed both recommendations. The
milestones below follow the recommended answers:

- Option M of decision 1. The standalone shell trusts the output of its own
  core: it keeps the version gates, the delivery fences, and its URL path
  grammar. The embedded entry and the wrapper check with a slim Rust reader
  as wasm2js. That reader adds about 350 KB gzip to the embedded entry, and
  `shell.js` gets smaller.
- Option D of decision 2. The core applies the rules of both sides. A viewer
  applies only the rules that keep its data safe and its content right.

`mokly-model` drops `jsonschema` for its own validator of the prop schema
profile, and it gains a lenient read mode. A new crate exposes the readers to
JavaScript. When an answer differs from the recommendation, this plan
changes before work starts.

The change covers the checks: every JSON document that the viewer reads, the
prop schema profile, the control edit checks, and the path grammar. Copies
of derivations stay, for example
`packages/viewer/src/shell/catalogue_branch_point.ts` beside
`crates/mokly-compare/src/lookup.rs`, and the key computation of the wrapper
in `packages/mokly/src/authoring/`. The trial results and their commands are
in `.context/viewer-checks-from-rust/trial-results.md`.
[design-calls.md](./viewer-checks-from-rust/design-calls.md) gives my design
calls of 2026-11-02.

Contract owners:

- [Embeddable viewer](../docs/protocol/mokly-viewer.md) and
  [viewer namespace and version gates](../docs/protocol/mokly-viewer-namespace.md).
- [Serialization](../docs/protocol/mokly-catalogue-serialization.md) and
  [browser modules](../docs/protocol/mokly-export-browser.md).
- [Entry props](../docs/protocol/mokly-entry-props.md) and
  [component props](../docs/protocol/mokly-component-props.md).
- [Rust core architecture](../docs/architecture/rust-core.md) and
  [package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md), the
  [`mokly-model` README](../crates/mokly-model/README.md), and the
  [development guide](../docs/development/README.md).

Replaced ways:

- The TypeScript readers of the index, the details, the deployment file, the
  live descriptor, the render answer, and the removed page preview → the
  version gates and delivery fences of the standalone shell, and the readers
  of `mokly-model` through the module in the embedded entry. Consumers under
  `packages/viewer/src`: `catalogue/sources.ts`, `viewer/index_source.ts`,
  `standalone/data_source.ts`, `standalone/live_source.ts`,
  `standalone/live_render.ts`, and `review/page_preview.ts`. Also the root
  `scripts/large/delivery.ts`, and the tests, helpers, and browser specs that
  read fixtures. Moved in Milestones 8 and 9. Deleted in Milestone 11.
- The fences of `catalogue/detail_fences.ts` → the fence of `mokly-model` in
  the embedded entry, and the delivery fence of design call 8 in the
  standalone shell. Consumers: `shell/data_requests.ts`,
  `shell/data_commit.ts`, and their tests. Moved in Milestones 8 and 9.
  Deleted in Milestone 11.
- The profile validators, key checks, and SHA-256 of
  `packages/viewer/src/components/` and `packages/viewer/src/data/` → the
  Rust validator and key checks through the module. Consumers:
  `catalogue/component_values.ts`, `shell/control_values.ts`,
  `previews/request.ts`, `packages/mokly/src/authoring/components.ts`, and
  their tests. Moved in Milestones 8, 9, and 10. Deleted in Milestone 11.
- `jsonschema` in `mokly-model` → its own profile validator. Consumers:
  `validation.rs`, and the callers of `PropValidator` and
  `validation::accepts` in `mokly-catalogue`, `mokly-graph`, `mokly-html`,
  and `mokly-server`. Moved and deleted in Milestone 3. `mokly-catalogue`
  keeps `jsonschema` for its configuration check in `config_validation.rs`.
- The hand-written `ComponentRenderSuccess` type of
  `packages/viewer/src/components/render_types.ts` → a generated type of the
  render answer. Consumers: `standalone/live_render.ts` and
  `shell/component_controls_state.ts`. Moved in Milestone 6. Deleted in
  Milestone 11.

## Milestone 1: Documentation and protocol

Depends on: none

- [ ] `docs/protocol/mokly-viewer.md`: the standalone shell reads only the
      output of its own core, through the version gates and the delivery
      fences. The embedded viewer checks every document with the core's
      readers before it renders.
- [ ] Add the decision in force beside that rule: one implementation from
      the Rust model, as plain JavaScript, only where JSON that Rust did not
      write enters. Name the rejected options and their reasons.
- [ ] `docs/protocol/mokly-catalogue-serialization.md:106-115`: a lenient
      reader applies only the rules that every reader needs. The core
      applies every rule.
- [ ] `docs/protocol/mokly-entry-props.md:60-63`: one validator of the
      profile serves the core, the wrapper, and the viewer. It generates no
      code, so a site needs neither `'unsafe-eval'` nor `'wasm-unsafe-eval'`.
      Add the reserved-name rule for schema properties.
- [ ] `docs/protocol/mokly-export-browser.md`: Serve serves the validator
      module, and the static output does not copy it.
- [ ] `docs/architecture/rust-core.md` and
      `docs/architecture/package-boundary.md`: add `mokly-model-js`, and say
      where the model's checks run as JavaScript.
- [ ] `packages/viewer/docs/deployment/README.md`: the viewer needs no
      `'unsafe-eval'` and no `'wasm-unsafe-eval'`.

## Milestone 2: Inventory, roles, and shared cases

Depends on: 1

- [ ] Compare every check of the TypeScript readers, fences, validators, and
      grammar with the Rust side. Save the table under
      `.context/viewer-checks-from-rust/inventory.md`.
- [ ] Give each rule its role under design call 6. Record the roles as
      design calls in `design-calls.md`.
- [ ] Add a TODO under Milestone 5 for each difference.
- [ ] Write the shared cases under `crates/mokly-model/src/_tests_/fixtures/`.
      Each case gives a document, a mode, and the expected outcome. Cover
      each rule with a valid and an invalid case.
- [ ] Write the shared grammar cases for the parity test of design call 15.

## Milestone 3: One prop schema validator in Rust

Depends on: 1

- [ ] Write the validator of the profile in `crates/mokly-model`: keyword
      placement, keyword values, types, `enum`, `const`, `oneOf`, `anyOf`,
      properties, items, bounds, lengths in code points, and `multipleOf`.
- [ ] Keep the JSON Pointer paths and the message texts of today's
      diagnostics, under design call 11.
- [ ] Run the new validator and `jsonschema` side by side over generated
      schemas and values. Save the result under
      `.context/viewer-checks-from-rust/`.
- [ ] Remove `jsonschema` from `crates/mokly-model/Cargo.toml`.
- [ ] Run `cargo test` for `mokly-model`, `mokly-catalogue`, `mokly-graph`,
      `mokly-html`, and `mokly-server`. The snapshots stay unchanged.

## Milestone 4: Strict and lenient reading

Depends on: 1

- [ ] Give the index, detail, deployment, and live readers a strict mode for
      the core and a lenient mode for JavaScript callers.
- [ ] Decode each tagged union through a raw record, and remove the
      `deny_unknown_fields` attributes, under design call 5.
- [ ] Move the privacy walk of `packages/viewer/src/catalogue/privacy.ts`
      into `mokly-model`.
- [ ] Port each case of `packages/viewer/tests/reader_unknown_fields.test.ts`
      to a Rust test of the lenient mode.
- [ ] Move each Rust test that expects `ReadError::Invalid` for an unknown
      field to the strict-mode error. The field stays rejected.

## Milestone 5: The decided rules in Rust

Depends on: 2, 3, 4

- [ ] Wait for the merge of `plans/follow-ups/select-option-builder.md`, so
      that the select-option check adds no build error.
- [ ] Reject schema properties named `__proto__`, `constructor`, or
      `prototype` with the schema diagnostic, in both modes.
- [ ] Apply each rule that Milestone 2 lists, in the modes of its role.
- [ ] State each rule in the protocol doc that owns its field, where the doc
      is silent today.
- [ ] Build the example catalogue with `--strict`. A new build error there is
      a writer bug. Fix the writer in this milestone.

## Milestone 6: Fences, documents, and grammar

Depends on: 2, 4

- [ ] Add the fence of design call 8, and use it in `detail_context`.
- [ ] Move the render answer shape from `crates/mokly-server/src/preview.rs`
      into `mokly-model`, with a lenient reader and a generated type.
- [ ] Add a lenient reader for `RemovedPagePreview` and the historical
      snapshot identity check of `previews/request.ts`.
- [ ] Add a compiled schema that validates many props, and the control draft
      checks of `packages/viewer/src/shell/control_values.ts`.
- [ ] Run the shared grammar cases through the Rust grammar and through
      `navigation/logical.ts`. Align the side that the inventory marks wrong.

## Milestone 7: The JavaScript module and its build

Depends on: 3, 6

- [ ] Add `crates/mokly-model-js`, a `cdylib` and `rlib`, with its README,
      the ABI, the handle tables, and the JSON envelopes. Test it natively.
- [ ] Add `cargo xtask build-model-js`: the WebAssembly build, `wasm-opt`
      with the lowering passes and `-Oz`, `wasm2js -Oz`, and esbuild minify.
      Pin its commands in the xtask tests.
- [ ] Add `targets = ["wasm32-unknown-unknown"]` to `rust-toolchain.toml`,
      and pin `binaryen` in the root `package.json`.
- [ ] Run the build from `npm run build`, and copy the module into the
      viewer's `dist` with a declaration file.
- [ ] Give Rust with the target to every workflow job that builds the
      viewer, also `release-check` `package-and-smoke`. Keep the timeout rule
      of `docs/protocol/ci-workflow.md`.
- [ ] Update the toolchain text of `docs/development/README.md`,
      `docs/protocol/ci-workflow.md`, `docs/protocol/npm-release.md`, and
      `docs/protocol/remote-verification-testbox.md`.
- [ ] Add a Node test that runs the shared cases through the built module
      and expects the native outcomes.

## Milestone 8: The standalone shell trusts its own core

Depends on: 6, 7

- [ ] Read each document in `standalone/` through its version gate only.
      Fence each detail with the delivery fence of design call 8.
- [ ] Add the parity test of the delivery fence against the Rust fence.
- [ ] Load the validator module for Serve's live prop edits, under design
      call 13. Update the browser module inventory, Serve, the static build,
      and `packages/viewer/tests/boundary.test.ts`.
- [ ] Move each standalone test of a replaced reader to the new path, with
      every assertion of behaviour that stays.
- [ ] Measure `shell.js` before and after. Save the numbers under
      `.context/viewer-checks-from-rust/`.

## Milestone 9: The embedded entry reads through the module

Depends on: 5, 7

- [ ] Add the wrapper under `packages/viewer/src/model/`: marshalling, the
      handles of design call 7, `MoklyVersionError` with the protocol
      diagnostic, and invalid data errors.
- [ ] Read text for read-model routes, under design call 9.
- [ ] Move each embedded consumer of the replaced ways to the module. Keep
      the public names of design call 10.
- [ ] Move each test of a replaced reader to the public function, with every
      assertion. A message assertion moves to the Rust message of the rule.
- [ ] Run the browser specs, with the strict-policy host of
      `tests/browser/comparison_viewer_host.ts`.

## Milestone 10: `@mokly/mokly` checks through the module

Depends on: 5, 7

- [ ] Compile each definition's schema once in
      `packages/mokly/src/authoring/components.ts`, and validate the props
      of each render with it.
- [ ] Measure a React build of the large fixture before and after. Save the
      numbers under `.context/viewer-checks-from-rust/`.

## Milestone 11: Delete the TypeScript checks

Depends on: 8, 9, 10

- [ ] Delete each replaced module that no consumer uses, under the dead-code
      test of the `git-commit` skill. Save the searches under
      `.context/viewer-checks-from-rust/`.
- [ ] Update the viewer README, the shell README, the `mokly-model` README,
      and the unused internal export baseline.
- [ ] Delete `plans/follow-ups/viewer-checks-from-rust.md`. Update the
      **Related** line of `plans/follow-ups/select-option-builder.md`.

## Milestone 12: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Measure the embedded entry and the first index read in Chrome on the
      example and the large fixture. Save the numbers under
      `.context/viewer-checks-from-rust/`.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test Browse, Changes, a
      comparison, inspection, prop editing, a removed entry, and an embedded
      host through `npm run dev`.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Mokly Cloud pins `@mokly/viewer` 0.5.0 today, in
      `mokly-cloud/ts/app/package.json:22`. After Cloud moves to a release
      with this change, open an embedded catalogue there. Both of its content
      security policies stay unchanged, and the viewer reads the catalogue.
