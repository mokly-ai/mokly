# Serve edit salt changes identities across processes

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-edit-comparison-cost-bo07`, at the request of the
  performance orchestrator, after a control run of unchanged `main` at
  `793d0c77d`.
- **Location:** `packages/mokly/src/sidecar/bundle-recipe.ts:137` to line 147,
  `crates/mokly-render/src/graph.rs:149` to line 161,
  `crates/mokly-graph/src/graph.rs:269` to line 279,
  `crates/mokly-server/src/changes_execution.rs:133` to line 143,
  `crates/mokly-render/src/persistent_identity.rs:6`, and the section "Reuse
  And Identity" of `docs/protocol/mokly-sidecar-recipes.md`.
- **Reason:** On 2026-11-21 the user kept the product identity unchanged and
  asked for this separate item. The branch that found it changes only head
  closure validation.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Serve edit compile:** a head `bundle` request with
    `capture: "serveEdit"`, which Serve sends after it publishes its first
    state, and which records no capture evidence.
  - **Runtime key:** the random import name `mokly:runtime:` plus 48 hex
    characters that each compile attempt gives the authoring runtime.
  - **Generation id:** the sidecar's id of one compiled bundle, a hash of the
    compilation identity and the core's evaluation digest.
  - **Whole-bundle key:** `RenderKeys::fallback`, the render key of each module
    without its own render input key, which hashes the generation id.
  - **Comparison root:** the index's `comparisonUrl`,
    `mokly-viewer/diffs/generations/{id}/`, whose id hashes the review, the
    snapshot record, and the head generation key.
- **Background:**
  - Mokly Serve serves a mockup catalogue and watches its sources. After each
    edit, a classification, one Changes pass, compares the new head with the
    base and publishes the result.
  - Serve uses Serve edit compiles for its head after it publishes its first
    state. Earlier head compiles, the base side, `build`, and `publish` send
    `full` compiles. A marked Serve edit compile carries
    `uncaptured: "serveEdit"`. A later Serve edit request of the same process
    can reuse it, with its generation id, under the live checks.
  - The identity chain on `main` at `793d0c77d1b096eb988e681963be4bca7a8df353`:
    - `packages/mokly/src/sidecar/bundle.ts:185` makes a new runtime key for
      each compile attempt. `bundle-recipe.ts:137` to line 138 hashes it into
      the compilation identity when the reuse evidence is not complete.
    - Lines 214 to 222 do the same when the frame limit drops the evidence. A
      Serve edit compile records no capture evidence, so it always gets the
      salt.
    - `generationId` at `packages/mokly/src/sidecar/compiled.ts:31` hashes the
      identity. `crates/mokly-render/src/graph.rs:149` to line 161 hashes the
      generation id, the class maps, and the bindings into the whole-bundle key.
    - The generation key hashes the config key, each document key, each
      resource document key, and the whole-bundle key, at
      `crates/mokly-graph/src/graph.rs:269` to line 279.
    - Serve publishes the generation key as `live.generation` and in
      `live.json`, at `crates/mokly-server/src/snapshot.rs:147`.
    - The classification id hashes the review, the snapshot record, and the
      head generation key, at `changes_execution.rs:133` to line 143.
      `crates/mokly-server/src/changes.rs:187` puts it in `comparisonUrl`.
    - A static build names its generation from its files, at
      `crates/mokly-static/src/comparison_output.rs:67`. Serve captures
      snapshots on demand, so it hashes the classification inputs instead.
  - The purpose of the salt:
    - The recipe rules give each incomplete compilation a fresh identity at
      each compile. Then the binary never reuses the definitions of an earlier
      generation for it.
    - `describe` at `crates/mokly-render/src/bundle.rs:152` to line 168 reuses
      the definitions of a live bundle with an equal generation id. The salt
      prevents that match.
    - The whole-bundle views of an incomplete compile also never reuse an
      earlier render, because their key carries the same id.
  - Other compiles that get the salt:
    - An unmarked Serve edit compile is never reused. Each rebuild of such a
      catalogue compiles again with a new salt.
    - A `full` compile with incomplete evidence gets it too, for example with a
      package-name `extends` or an unknown toolchain. Then two fresh processes
      also get different ids.
  - A fresh process differs even without the salt:
    - A `full` compile also hashes its identity inputs, at
      `bundle-recipe.ts:139` to line 147. They are the `jsconfig.json`
      candidates, the `extends` targets, and the resolved peer manifests.
    - They also include the `tsconfig.json` and `package.json` candidates above
      the source root, present or absent, from `physical-inputs.ts:87`.
    - A Serve edit compile records none of them. So the removal of the salt
      alone would not make a warm root and a fresh root equal.
  - `crates/mokly-graph/src/render_inputs.rs:141` to line 165 gives the
    whole-bundle key to each module without its own key:
    - Stories files use it when the module graph does not name the preview.
      Entry modules use it when the graph does not name the renderer. All
      modules use it when the key calculation fails.
    - Document keys read it at `crates/mokly-graph/src/planning.rs:144`, and
      fragment keys at `crates/mokly-graph/src/fragments.rs:65`. No other
      document or fragment key contains a generation id.
  - The control of 2026-11-21 used the release core and the npm packages of
    `793d0c77d`, with no change:
    - The fixture was a Git repository. Its `mokly.config.json` set
      `renderer: "renderer.mjs"`, `review.base: "fixture-base"`, and the
      stylesheet `theme.css` for every entry.
    - It had the screens `home` and `stable` and the components `card` and
      `retired`, each with a desktop and a mobile light view. `fixture-base`
      named the first commit.
    - Warm run: start Serve and wait for `ready`. Change the `home` message
      from `Original` to `Edited` in `specs/home.mockup.ts`. Wait for `ready`.
    - Fresh run: start a new Serve process on the edited tree, and wait for
      `ready`.
    - Each run read the current documents, the before and after snapshots of
      each entry's selected comparison, and their stylesheet and asset files.
    - The warm root id was
      `0cdbb4f5d8e5dee18c926efda61efe0bdfc4cff10a43f091713aad439240f5a9`.
      The fresh root id was
      `14da4b8b460f80db2f4c0308f1d9bbea256db8f562f168b3edd68601f6721e05`.
    - All 45 pairs of body and content type were equal, with the aggregate
      digest `a1849067130e41dd3e0c8dd37a8fd4104723f83beab2e837f8940afb298f6454`.
      The complete details, each exact `detailId`, and the 8 document keys
      were equal.
    - Limits: one run of each kind. The control did not record the evidence
      state of either compile. So it cannot tell whether the salt or the
      identity inputs caused the different roots.
  - Cache effects across a restart, by code reading. Nobody measured them:
    - No cache that outlives a Serve process holds an entry under a salted
      identity. So the salt alone loses no reuse across a restart.
    - Every Serve response is `no-store`, under
      [Routes](../../docs/protocol/mokly-runtime.md#routes). Each process has
      its own `deploymentId`, from `crates/mokly-cli/src/serve_delivery.rs:78`,
      so an open shell reloads the whole page after a restart.
    - The sidecar part of a render store key hashes the toolchain and the
      metadata identity, from `persistent_identity.rs:6`. That part exists
      only for captured, durable evidence, under the store's
      [identity rule](../../docs/protocol/mokly-render-store.md#identity).
    - So Serve never reads or writes the sidecar-rendered documents of a Serve
      edit compile. The bundle cache never stores a marked or incomplete
      compilation.
    - The render cache, the released recipes, and the kept view comparisons
      end with the process. Memory-only comparisons are a decision in force,
      not a defect.
    - A restart after unreverted edits compiles the head again and renders
      the edited documents again. The capture decision of 2026-11-18 causes
      that cost, not the salt.
    - These values do differ across processes: `live.generation`, the
      comparison root, and the document keys of whole-bundle views.
  - Cache effects within one process, by code reading. Nobody measured them:
    - A JavaScript edit changes the compilation identity anyway, because the
      identity hashes the source bytes. So the salt matters only when an
      incomplete compile repeats an otherwise equal identity.
    - Marked reuse keeps the generation id. So a CSS-only or YAML-only rebuild
      and a manual `r` add no new salt. A revert can reuse a kept recipe and
      get its earlier id back.
    - Two cases repeat an equal identity with a new salt. One is a revert that
      no kept recipe holds. The other is a new or removed file, such as an
      editor file, in a consumed-module directory.
    - Then the core describes the bundle again, as the fresh-identity rule
      requires. Whole-bundle documents and fragments miss the render cache.
    - An open shell reloads each whole-bundle frame. A new `live.generation`
      makes it fetch `live.json` again and render its current live props
      again. The next classification names a new comparison root.
    - When every entry module has its own render input key, as in the control,
      no document or fragment key carries the salt. Then the repeated work is
      one describe call, one descriptor fetch, and at most one live render.
  - Requirements that stay:
    - An incomplete compilation, marked or not, gets a fresh identity at each
      compile. A complete compilation keeps a deterministic identity. Source:
      [Reuse And Identity](../../docs/protocol/mokly-sidecar-recipes.md#reuse-and-identity).
    - Decision of 2026-11-18: a Serve edit compile captures nothing and stores
      nothing. Restarts keep the base hit and the hit of an unchanged head.
      Source: [Capture Modes](../../docs/protocol/mokly-sidecar-recipes.md#capture-modes).
    - `live.generation` hashes the config, every `documentKey`, every
      stylesheet bundle with its assets, and any consumer bundle generation,
      on purpose. Source:
      [Catalogue Index](../../docs/protocol/mokly-shell-delivery.md#catalogue-index).
    - The whole-bundle key contains the generation id. Source:
      [Bundling](../../docs/protocol/mokly-sidecar.md#bundling).
    - On 2026-10-27, PR #227 kept the bundle fingerprint in the live
      generation, so that the shell and the Changes identity keep their
      behaviour.
    - One comparison gives the same generation file bytes in every build and
      Serve process. The same paragraph says that the generation name hashes
      the files. Source:
      [Generation And Serving](../../docs/protocol/mokly-comparison-serving.md#generation-and-serving).
      This item does not decide whether that sentence needs new words.
    - Only Serve keeps view comparisons, in memory. A disk cache was rejected,
      because it adds persistent state beyond one process. Source:
      [View Comparison Reuse](../../docs/protocol/mokly-comparison-serving.md#view-comparison-reuse).
    - User decision of 2026-11-21: keep the product identity unchanged. Tests
      check the comparison root for stability and stage transitions within
      each process. They compare its named content across processes, with
      exact detail ids, snapshot ids, and base commits.
- **Problem:** After a Serve edit compile, a random runtime key enters the head
  generation id. Then `live.generation`, the comparison root, and whole-bundle
  document keys differ from a fresh process, although bodies and details match.
  Nobody has measured whether any cache repeats work because of it.
- **Impact if no action:** Checks that compare Serve processes must keep
  comparing named content, not roots. Repeated equal compiles in one process
  keep an extra describe call and their whole-bundle renders, at an unknown
  cost.
- **Root question:** How can Serve avoid work that only the random identity of
  incomplete compiles repeats, while it keeps fresh identities and complete
  proofs?
- **Options:**
  - **A.** Change nothing. Keep the salt, the identity chain, and the test
    rule of 2026-11-21. Repeated equal compiles keep their extra work. Effort:
    Small.
  - **B.** Measure first, with no product change. It costs one investigation.
    Effort: Medium.
    - For each head preparation, count the evidence state, salted ids, and
      describe calls against reused definitions.
    - Count the whole-bundle modules, their render cache misses, the views
      compared again, and the time of that work.
    - In one process, edit JavaScript, revert it, and edit CSS. Add and remove
      an editor file in a consumed-module directory.
    - Then restart on the edited tree. Count the render store reads, writes,
      and skips by reason, and the bundle cache result.
    - Run the four-entry fixture above, `examples/basic`, and the default React
      variant of the [large fixture](../../tests/fixtures/large/README.md).
    - Also run a catalogue with a linked `.storybook` folder, as
      `crates/mokly-render/tests/integration/key_fallback_tests.rs:50` builds,
      and a catalogue with a package-name `extends`.
    - Keep the probe and its results out of the repository, and add no test.
      Record the counts here, and then recommend A, C, or D.
  - **C.** Name each Serve comparison generation from content keys only: the
    config, document, and resource document keys. Effort: Medium.
    - Generation ids and `live.generation` keep the salt. A whole-bundle
      document keeps it in its own key, so the name still moves when the
      compile cannot prove that document.
    - Equal content then gives an equal root across processes, as in the
      control, and across repeated equal compiles.
    - It changes the choice of 2026-10-27 for the Changes identity. It needs a
      proof that classifications with one shared name capture equal bytes.
    - It inherits the render input key gap of `jsconfig-resolution-input.md`.
      It saves no cache reuse across a restart.
  - **D.** Give each Serve edit compile complete and stable evidence, by
    capture or by promotion with proven evidence. Effort: Large.
    - The compile then keeps a deterministic identity. The render store also
      keeps its documents for a later restart.
    - `serve-pause-warm-head.md` owns these mechanisms. Its promotion option
      also needs an identity rule for a promoted compile.
    - It changes the decision of 2026-11-18. It adds capture or promotion work
      beside each edit.
- **Left out:**
  - Remove the salt, or use a fixed value or a counter. It breaks the
    fresh-identity rule, so `describe` and whole-bundle views could reuse
    results of other code. Alone, it would not make the roots equal.
  - Derive the identity from the compiled output. It drops the fresh-identity
    rule, which the recipe rules and the orchestrator's request of 2026-11-21
    keep. Nobody has proved that equal output gives equal definitions.
  - Record the identity inputs in a Serve edit compile and drop its salt. The
    compile stays incomplete, so the fresh-identity rule still applies.
  - Name `live.generation` from content keys. The shell could keep a live
    render of changed code. Shell delivery keeps the bundle generation in it
    on purpose.
  - Give whole-bundle views a content key, as
    `fallback-keys-checkout-folder.md` proposes. For an incomplete compile,
    such a key misses the unrecorded inputs, so it is not a complete proof.
  - Keep comparisons across restarts. The decision in force keeps them in
    memory only, and an open shell reloads after a restart anyway.
- **Assumptions:**
  - Each incomplete compilation gets a fresh identity at each compile, and
    each reuse keeps a complete proof. Source: the recipe rules and the
    orchestrator's request of 2026-11-21. Every option keeps both.
  - Serve keeps view comparisons in memory only, and `live.generation` keeps
    the bundle generation. Source: the protocol sections above. Every option
    keeps both.
  - A Serve edit compile captures nothing and stores nothing. Source: the
    decision of 2026-11-18. D drops it.
  - The product identity stays unchanged. Source: the user decision of
    2026-11-21. C and D change it, so each needs the user.
- **Wider fix:** None, because this is a cost and identity question, not a
  class of defect.
- **Previous examples:** `package-tsconfig-extends-reuse.md` records the same
  fresh identity for `full` compiles with a package-name `extends`. There the
  core describes the bundle again, and whole-bundle views render again.
- **Related:**
  - [fallback-keys-checkout-folder.md](./fallback-keys-checkout-folder.md):
    the same code. That item removes the checkout folder from document keys,
    and this item covers the runtime key. Each item can merge alone.
  - [serve-pause-warm-head.md](./serve-pause-warm-head.md): the same restart.
    It owns the head compile after unreverted edits. D of this item waits for
    its decision, because both change the decision of 2026-11-18.
  - [package-tsconfig-extends-reuse.md](./package-tsconfig-extends-reuse.md):
    the same cause in `full` compiles. B measures such a catalogue.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): render
    input keys omit some configuration files. C inherits that gap.
- **Recommendation:** B. No option is clearly best until a count shows work
  that only the salt repeats. Code reading finds no loss across a restart, and
  B checks both cases without a product change.
- **Action:** fix after merge, apply B, because the user asked on 2026-11-21
  for this separate item and kept the product identity unchanged.
