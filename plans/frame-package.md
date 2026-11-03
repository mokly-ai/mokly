# Frame package

Status: Active. On branch `calummoore/viewer-inspector-purpose`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The frame code lives inside `@mokly/viewer`. It is the frame adapters under
`packages/viewer/src/client` and the in-frame inspector under
`packages/viewer/src/inspector`, about 3,300 lines. Nothing stops this code
from importing viewer internals, so its boundary is only a convention. This
change moves the frame code into a new lockstep package, `@mokly/frame`,
under `packages/frame`. The Rust half of the inspector contract stays in
`crates/mokly-static` and `crates/mokly-server`. The change keeps the
behaviour of the frames. It does not merge the two event runtimes, and it
does not accept new host origins, such as the `mokly-app://desktop` origin
of Mokly Cloud. It renames the inspector only when decision 3 asks for a
rename.

Decision 2, 2026-11-03, by the user: move the frame code to a new lockstep
package. The alternatives were to keep the code as it is, with the boundary
as a convention, and to add an import-rule zone in the viewer. The reason: a
package boundary stops each import of viewer internals at the compiler,
which a lint only finds. The `@mokly/ui` package decision gives the same
reason.

Contract owners:

- `docs/protocol/mokly-frame-package.md`, which Milestone 1 adds.
- The [viewer frame adapter](../docs/protocol/mokly-frame-adapter.md).
- The [published inspector](../docs/protocol/mokly-published-inspector.md).
- The [inspector wire protocol](../docs/protocol/mokly-inspector-wire.md).
- The [package boundary](../docs/architecture/package-boundary.md).
- The [registry bootstrap](../docs/protocol/npm-bootstrap.md) and the
  [release contract](../docs/protocol/npm-release.md).
- The [client README](../packages/viewer/src/client/README.md) and the
  [inspector README](../packages/viewer/src/inspector/README.md).

Replaced ways:

- Frame code in `packages/viewer/src/client` and
  `packages/viewer/src/inspector` → the `@mokly/frame` package. Consumers:
  about 30 viewer source files, `packages/viewer/src/index.ts`, the viewer
  build scripts, 13 files under `packages/viewer/tests`, 18 root tests,
  helpers, and browser specs, four lint tests, and
  `scripts/verification/prepared.mjs`. Moved in Milestones 4 and 5. Deleted
  in Milestone 5.
- Model code in the viewer → its home under decision 4. Consumers: the
  frame code, the viewer files that use the path and link grammar, the
  delivery paths, the data paths, and the generated types, and
  `@mokly/viewer/data`. Moved and deleted in Milestone 3.

## Design

These are design calls of the planning agent, made on 2026-11-03.

- The package is `@mokly/frame` under `packages/frame`. The name matches
  the frame adapter terms of the protocol docs. The user can change it
  before the npm registration. Its file names stay snake_case, as
  `AGENTS.md` says for every package except `@mokly/ui`.
- The package releases in lockstep, and `@mokly/viewer` pins its exact
  version, as for `@mokly/ui`. The viewer is compiled with `tsc`, so it can
  depend only on a published package.
- The package holds both sides: the adapter interface, `sameOriginAdapter`,
  `temporaryPreviewAdapter`, `postMessageAdapter`, the message transport,
  the wire schema, the measuring code, and the in-frame inspector. Both
  ends of the wire protocol and their shared measuring code then stay
  together.
- The functions that only the frame code calls move with it:
  `frameLinkActivation`, `parseLogicalMarker`, `logicalMarker`,
  `currentDocumentRoute`, and all of `navigation/target.ts`. The shell keeps
  `eligibleAnchor`. `@mokly/viewer/data` keeps exporting
  `currentDocumentRoute`.
- `@mokly/viewer` re-exports the public adapters and frame types. Hosts
  import them only from the viewer. The frame code keeps state in
  module-level maps, such as `frame_mount.ts`, `frame_session.ts`, and
  `same_origin_identity.ts`. Two installed copies would split these maps.
- The package has one internal subpath, `@mokly/frame/internal`, for the
  parts that only the viewer uses: the frame session registry, `FrameError`,
  `frameUsage`, `cancelFrameMount`, `localFramePath`,
  `temporaryPreviewAdapter`, `clipNode`, and the rectangle helpers. The
  shell's session data stays out of the public `FrameMount` interface, as
  `frame_session.ts` intends.
- Shell-only helpers stay in the viewer: `cleanup.ts`, `inspection_work.ts`,
  and `visibleFrameBox`. No frame code uses them.
- The package builds `inspector.js`. The viewer build copies it into
  `packages/viewer/dist/browser` and its browser manifest. The CLI, the Rust
  server, the static build, and the Mokly Cloud fixtures keep the same file.
- Unit tests move with the code to `packages/frame/tests`. Root tests import
  `packages/frame/dist`. Browser specs stay in `tests/browser`, because they
  need the whole viewer.
- No new lint zone. The `tsc` build of each package sets `rootDir` to its
  `src`, so it rejects a relative import into another package.

## Decisions

Decision 2 is answered above. Decisions 4, 1, and 3 are open. On
2026-11-03, a read-only options check reviewed them. Its report is in
`.context/frame-package/options-check.md`. This section merges its result.

### 4. The frame code needs viewer model code

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `packages/viewer/src/navigation/logical.ts`,
  `packages/viewer/src/catalogue/delivery_paths.ts`,
  `packages/viewer/src/data/paths.ts`, and
  `packages/viewer/src/generated/catalogue`.
- **Terms:**
  - **Model code:** the catalogue rules and types that both the frame code
    and the viewer use. After the frame-only functions move, it is the path
    and link grammar of `logical.ts`, about 60 lines, `currentDocumentPath`,
    `RENDERS_PATH`, `RENDER_ID`, the data paths, the namespace constants,
    and the usage types.
  - **Generated types:** the TypeScript types that
    `cargo xtask generate-types` writes from the Rust model.
- **Background:**
  - Many viewer files use the model code. 11 use the logical path grammar,
    and 12 use the delivery paths.
  - `@mokly/mokly` imports the grammar through `@mokly/viewer/data`, in
    `src/authoring/links.ts` and `src/sidecar/session.ts`. Three protocol
    docs require that entry. It must re-export the model code from its new
    home.
  - The generator already writes into two packages. The gate runs
    `cargo xtask check-generated-types`, which compares each generated file
    byte for byte.
  - The generator adds an import of `catalogue/delivery_paths.js` to the
    generated `RenderCapability.ts`, in
    `crates/mokly-model/src/typescript.rs:58-62`.
  - On 2026-11-01 the user chose to compile the Rust checks to JavaScript
    later, in `plans/follow-ups/viewer-checks-from-rust.md`. The in-frame
    script has 955 bytes left of its 9,216-byte budget, so it keeps a
    TypeScript path check under every option.
  - A package cannot import viewer source. `@mokly/ui` cannot hold the code,
    because its contract allows no catalogue type.
- **Problem:** The frame package and the viewer both need the model code.
  The code has no home outside the viewer.
- **Impact if no action:** Milestones 3 to 5 cannot start.
- **Root question:** How does the frame package get the catalogue rules and
  types that it uses, with one implementation of each rule and no import of
  viewer source?
- **Options:**
  - **A.** Move the model code into `@mokly/frame`. The viewer and
    `@mokly/viewer/data` import it from there. The generator writes the
    usage types and the namespace constants into the frame package, and the
    gate keeps each generated copy exact. The frame package then owns
    catalogue rules that many viewer files use. Effort: Medium.
  - **B.** Add a lockstep model package, such as `@mokly/model`, for the
    model code and the generated types. The frame package and the viewer
    depend on it. It would be the fifth JavaScript package, with its own
    release wiring and npm registration. Effort: Large.
  - **C.** Give the frame package its own inputs. It takes a frame instance
    map instead of `CatalogueUsage`, and it holds its own wire checks for
    paths, fragments, and targets. The viewer converts the catalogue usage
    into that map, as `frame_usage.ts` does today. The public `FrameMount`
    interface then changes for custom adapters. Mokly Cloud passes only
    `postMessageAdapter`, so no known host breaks. Effort: Large.
  - **D.** The viewer passes the rules in. The adapters and the wire
    validators take the checks as a typed parameter. The viewer bundles
    `inspector.js` with its own path check. No rule moves, and no package is
    added. The frame package cannot build or test its in-frame script alone.
    Effort: Large.
  - **E.** One source, built into each package. A private workspace package,
    such as `packages/model`, holds the model code. Before each `tsc` run, a
    build step copies its sources into the frame package and the viewer as
    Git-ignored files. The copies cannot drift. The costs are a copy step in
    two builds, a second copy in `shell.js`, and the risk that people edit a
    copy. Effort: Large.
- **Left out:** Put the model code in `@mokly/mokly`, or let the frame
  package import `@mokly/viewer/data`. Each makes a dependency cycle. Compile
  the Rust grammar now. The in-frame script cannot hold the compiled module,
  and the chosen follow-up already owns that work.
- **Wider fix:** B. One home for the model code serves every later package.
  E serves a later package too, without a registration.
- **Previous examples:** `@mokly/ui` needed no model code, because its
  components take props only, as
  [the UI package contract](../docs/protocol/mokly-ui-package.md) says.
- **Related:** Decision 2 chose the package. This decision blocks
  Milestones 3 to 5. Option B of decision 1 makes the model code smaller,
  because it deletes the only frame users of `currentDocumentPath` and
  `VIEWER_DIRECTORY`. `plans/follow-ups/viewer-checks-from-rust.md` later
  replaces the same grammar.
- **Recommendation:** A. The first recommendation was B. The model code is
  about 60 lines of grammar, a few constants, and generated types, which is
  too small for a fifth package with its own registration. B protects the
  codebase best, and it becomes the better choice when a third package
  needs these rules without the frame code.
- **Action:** ask the user, because the options have real trade-offs, and
  the choice decides the package layout.

### 1. Two frame models duplicate the event code

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `packages/viewer/src/inspector/runtime.ts`,
  `packages/viewer/src/client/same_origin_pointer.ts`,
  `packages/viewer/src/client/same_origin_highlight.ts`, and
  `packages/viewer/src/client/component_geometry.ts:28-120`.
- **Background:** `sameOriginAdapter` reads a local frame directly, with
  page scripts off. `postMessageAdapter` talks to `inspector.js` inside a
  cross-origin page. Both share the boundary listing, the box geometry, the
  clipping rules, and the marker pattern. Each has its own event runtime for
  hover, pick, Escape, link clicks, and layout changes. The same-origin pick
  also has a second geometry path, `rangeBounds`, and a second marker
  walker, `client/document_ranges.ts`.
- **Problem:** Each change to the event handling must be made in two
  runtimes. The runtimes already differ: during a highlight or a pick,
  `inspector/runtime.ts:57` reports hover only for the highlighted keys, and
  `client/same_origin_pointer.ts:22` reports hover for every instance.
- **Impact if no action:** Hosts get different hover events from local and
  cross-origin frames, and more differences can follow.
- **Root question:** How should the viewer inspect preview frames, so that
  we maintain the behaviour once and every hosting setup keeps working?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Keep both transports and share one event runtime. The same-origin
    adapter calls `inspectorRuntime` directly on the frame window. The
    runtime takes the link classifier as a parameter, so the in-frame script
    keeps its link map and the local adapter keeps
    `same_origin_navigation.ts`. Delete `same_origin_pointer.ts`,
    `same_origin_highlight.ts`, `rangeBounds`, and the second marker walker.
    The script has 955 bytes of budget left. Effort: Large.
  - **C.** Always use `postMessageAdapter` with a second real origin. Serve
    adds a second port and injects the script. Single-origin static hosts
    lose inspection, page scripts run in local previews, and masks lag one
    message round trip. Effort: Large.
  - **D.** Always use `postMessageAdapter` with an opaque-origin sandbox.
    The viewer must post with target `*`, fonts load with CORS checks, page
    scripts run, and masks lag. This reverses the decision that cross-origin
    frames need a real origin. Effort: Large.
  - **E.** Share the pick path, and keep two runtimes. The same-origin pick
    hit-tests the boundaries of the shared reader, as hover already does.
    Delete `rangeBounds`, `document_ranges.ts`, `component_range_nodes.ts`,
    and `component_occlusion.ts`. Hover, Escape, link clicks, and layout
    changes stay in two runtimes. Effort: Medium.
  - **F.** Find drift with a test. One browser spec drives hover, pick,
    Escape, link clicks, and geometry on both transports over one fixture,
    and compares the event streams. Each change is still made twice. It is
    a test for the class, so it needs the user's approval. Effort: Medium.
- **Left out:** Always use `sameOriginAdapter`, which fails the
  cross-origin need of Mokly Cloud. Use the same-origin modules as the one
  runtime, which would not fit in the 955 bytes. Allow page scripts in
  local frames, which would let page scripts reach the viewer.
- **Wider fix:** B. One runtime removes the drift for every later change.
  F is a detection fix, which ranks below B.
- **Previous examples:** PR #76 added `postMessageAdapter` for Mokly Cloud
  and extracted `sameOriginAdapter` from the older direct-read code.
- **Related:** `plans/follow-ups/frame-hover-during-highlight.md` asks which
  instances hover reports during a highlight. B and E must apply its
  answer. This plan does not wait for this decision. If you choose B, it
  runs as its own change, inside the frame package after Milestone 5, or
  before Milestone 5 when it starts first.
- **Recommendation:** B. One runtime removes the class, and the two
  runtimes already differ on hover.
- **Action:** ask the user, because the options trade hosting setup, page
  safety, and effort against each other.

### 3. "Inspector" names two different things

- **Severity:** Low. **Effort:** Large.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `packages/viewer/src/inspector`,
  `crates/mokly-static/src/inspector.rs`, and the two inspector protocol
  docs.
- **Background:** The shell's tabbed panel, `@mokly/ui/inspector`, has been
  the inspector since PR #41. Its accessible name "Inspector" is user-facing
  copy. PR #76 later named the in-frame script the inspector. The published
  names are the path `mokly-viewer/client/inspector.js`, the message channel
  `mokly-inspector`, and the page markers `data-mokly-inspector` and
  `data-mokly-inspector-link`. Wire version 2 with these names shipped in
  0.15.0, and the packages are at 0.18.0. The project is not in production.
- **Problem:** One word names two different parts that both work with
  component instances.
- **Impact if no action:** People and agents keep confusing the two parts.
- **Root question:** How do people and agents tell the in-frame script and
  the inspector panel apart?
- **Options:**
  - **A.** Keep the name. Effort: Small.
  - **B.** Rename the code only, for example to `frame probe`. The published
    names stay, so the code and the pages use two names for one thing.
    Effort: Medium.
  - **C.** Rename the code and the published names. Pages published before
    the rename must be published again. Mokly Cloud regenerates its contract
    fixtures. Effort: Large.
  - **D.** Qualify both names and rename nothing. Every README, protocol
    doc, and code comment says "frame inspector" for the script and
    "inspector panel" for the panel. `AGENTS.md` defines both terms. The
    bare word stays in the code and in the published names. Effort: Medium.
  - **E.** Rename the panel and keep every frame name. The panel's
    accessible name, the `@mokly/ui/inspector` subpath, its components,
    about 59 files under `examples/basic`, and
    `docs/protocol/mokly-component-inspector-design.md` change. No page must
    be published again. Effort: Large.
- **Left out:** A compatibility period that accepts the old and the new
  names is C with a shim, not a separate approach.
- **Wider fix:** None. A terms list in `AGENTS.md`, which is part of D, is
  the only step for the class, and nothing enforces it. A second case of
  the class exists: `navigation/target.ts` and `shell/target.ts` name two
  different targets.
- **Previous examples:** The wire protocol already changed from version 1
  to version 2. The 0.16.0 release asked for a rebuild of every published
  catalogue, without a shim.
- **Related:** If you choose B, C, or E before Milestone 4 starts,
  Milestones 4 and 5 apply the rename, so that the files move once.
- **Recommendation:** C, with the name `frame probe`. The first
  recommendation was also C, for a reason that was wrong: the names already
  shipped. The project is not in production, and the package move already
  moves every file of the script. D is the low-cost choice if you do not
  want a wire break.
- **Action:** ask the user, because C changes the published path and the
  message channel that the protocol docs require.

## Milestone 1: Documentation and protocol

Depends on: none. The model code section waits for decision 4.

The docs state the package, its boundary, and its release before the code
moves.

- [ ] Add `docs/protocol/mokly-frame-package.md` with a status line that
      links this plan. State the package, its root entry, its internal
      subpath, the re-export by the viewer, the rule that the package never
      imports the viewer, the CLI, or consumer code, the exact lockstep
      pin, the decision and its reason, and the home of the model code.
- [ ] Update `docs/protocol/mokly-frame-adapter.md`: `@mokly/frame` defines
      the interface and the built-in adapters, and `@mokly/viewer`
      re-exports them.
- [ ] Update `docs/architecture/package-boundary.md`, which says that the
      viewer owns the frame adapters and the in-frame inspector.
- [ ] Update `docs/protocol/npm-bootstrap.md`, `npm-release.md`,
      `npm-release-management.md`, and `npm-github-protections.md` with the
      registration, the publication order, and the trust of each new
      package.
- [ ] Update `docs/protocol/packed-consumer-smoke.md`,
      `docs/protocol/developer-test-commands.md`,
      `docs/protocol/developer-type-checks.md`, and
      `docs/protocol/ci-verification-repository.md`.
- [ ] Update `AGENTS.md`, `README.md`, and `scripts/release/README.md` with
      the package list and the build order.

## Milestone 2: Frame package skeleton

Depends on: 1.

The empty package builds, tests, and packs with the other packages.

- [ ] Create `packages/frame` with `package.json`, `tsconfig.json`,
      `tsconfig.build.json`, a build script, `README.md`, and `LICENSE`.
- [ ] Add the package to the root workspaces, the root build order, and the
      root `devDependencies`.
- [ ] Add it to `scripts/verification/run-viewer.mjs`, the typecheck runner,
      and the checks in `xtask/src/check/commands.rs`.
- [ ] Add it to the release scripts under `scripts/release`, including its
      registration in `bootstrap.mjs`, to `release-please-config.json`, to
      the release manifest, and to the packed-consumer smoke test.
- [ ] Add it to `.github/workflows/ci.yml` and
      `.github/workflows/release.yml`.

## Milestone 3: Model code home

Depends on: 2. It waits for decision 4. This milestone is written for
option A. If decision 4 gets another answer, rewrite this milestone before
it starts.

The model code moves out of the viewer, so that the frame package can use
it.

- [ ] Move the frame-only functions of the **Design** section into the
      package.
- [ ] Move the path and link grammar of `logical.ts`, `currentDocumentPath`,
      `RENDERS_PATH`, `RENDER_ID`, and the data paths into the package, with
      their tests.
- [ ] Point `cargo xtask generate-types` and its tests at the package for
      the usage types and the namespace constants. Change the import that
      `crates/mokly-model/src/typescript.rs` adds to `RenderCapability.ts`.
- [ ] Move every viewer consumer to the package. Re-export the moved
      functions from `@mokly/viewer/data`. Delete the old modules.

## Milestone 4: Move the in-frame inspector

Depends on: 3.

The in-frame inspector, the wire schema, and the measuring code move into
the package. The host adapters stay in the viewer for one milestone and
import from `@mokly/frame/internal`.

- [ ] Move `packages/viewer/src/inspector`,
      `packages/viewer/src/client/frame_adapter.ts`, and the scripts
      `inspector-bundle.mjs`, `inspector-pool.mjs`, and
      `inspector-pool.d.mts` with `git mv`. The inspector imports the frame
      types of `frame_adapter.ts`, so the types move first.
- [ ] Build `inspector.js` in the package. Copy it in the viewer build into
      `packages/viewer/dist/browser` and the browser manifest.
- [ ] Move `packages/viewer/tests/inspector_budget.test.ts` and
      `marker_ranges.test.ts`. Point `tests/inspector_inert.test.ts`,
      `tests/inspector_schema.test.ts`, and `tests/inspector_pool.test.ts`
      at the package.
- [ ] Apply decision 3 here when it has an answer.

## Milestone 5: Move the host adapters

Depends on: 4.

The host adapters move into the package. The viewer imports the package
only through its exports.

- [ ] Move `packages/viewer/src/client` with `git mv`, except `cleanup.ts`,
      `inspection_work.ts`, and `visibleFrameBox`, which move to
      `packages/viewer/src/shell`.
- [ ] Re-export the public adapters and frame types from
      `packages/viewer/src/index.ts`. Move each viewer consumer to
      `@mokly/frame` or `@mokly/frame/internal`.
- [ ] Move the frame unit tests from `packages/viewer/tests` to
      `packages/frame/tests`. Point the root tests, helpers, browser specs,
      `scripts/verification/prepared.mjs`, and the lint tests at the
      package.
- [ ] Move the client and inspector READMEs into the package README. Delete
      the old directories. Remove the status line of
      `docs/protocol/mokly-frame-package.md`.

## Milestone 6: Verification, commit, review, and pull request

Depends on: every other milestone.

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Smoke-test local Browse through `npm run dev`: hover, pick, Escape,
      and catalogue links in a screen and a component page.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] A maintainer registers each new package with
      `scripts/release/bootstrap.mjs` before the next release pull request
      merges.
- [ ] Tell Mokly Cloud that its next pin bump brings `@mokly/frame` through
      `@mokly/viewer`. Its imports do not change.
