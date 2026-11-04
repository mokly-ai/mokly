# Frame package and shared event runtime

Status: Active. On branch `calummoore/viewer-inspector-purpose`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The frame code lives inside `@mokly/viewer`. It is the frame adapters under
`packages/viewer/src/client` and the in-frame inspector under
`packages/viewer/src/inspector`, about 3,300 lines. Nothing stops this code
from importing viewer internals, so its boundary is only a convention. The
two frame adapters also run two event runtimes, which already differ on
hover.

This change does four things, in this order:

- It merges the two event runtimes into one shared event core, while the
  code is still in the viewer.
- It moves the catalogue rules and types that the frame code shares with the
  viewer into a new lockstep package, `@mokly/model`.
- It moves the frame code into a new lockstep package, `@mokly/frame`.
- It renames the in-frame inspector to the frame probe, published names
  included.

The Rust half of the probe contract stays in `crates/mokly-static` and
`crates/mokly-server`. The change keeps both transports and the
script-disabled sandbox of local frames. It does not accept new host
origins, such as the `mokly-app://desktop` origin of Mokly Cloud.

Contract owners:

- `docs/protocol/mokly-frame-package.md` and
  `docs/protocol/mokly-model-package.md`, which Milestone 1 adds.
- The [viewer frame adapter](../docs/protocol/mokly-frame-adapter.md).
- The [viewer selection contract](../docs/protocol/mokly-viewer-selection.md).
- The [published inspector](../docs/protocol/mokly-frame-probe.md)
  and the [inspector wire protocol](../docs/protocol/mokly-frame-probe-wire.md),
  which Milestone 1 renames to the frame probe.
- The [package boundary](../docs/architecture/package-boundary.md).
- The [registry bootstrap](../docs/protocol/npm-bootstrap.md) and the
  [release contract](../docs/protocol/npm-release.md).
- The [frame package README](../packages/frame/README.md) and the
  [frame probe README](../packages/frame/src/probe/README.md).

Replaced ways:

- The same-origin event code → the shared event core. The old way is
  `same_origin_pointer.ts`, `same_origin_highlight.ts`, `rangeBounds` and
  `authenticateRanges` in `component_geometry.ts`, `document_ranges.ts`,
  `component_range_nodes.ts`, and `component_occlusion.ts`. Consumers:
  `same_origin_mount.ts`, `same_origin_adapter.ts`, the unit tests of these
  modules, and `tests/browser/frame_clipping.spec.ts`. Moved and deleted in
  Milestone 3.
- Model code in the viewer → the model package. Consumers: the frame code,
  the viewer files that use the path and link grammar, the delivery paths,
  the data paths, and the generated types, `@mokly/viewer/data`,
  `cargo xtask generate-types`, and `crates/mokly-model/src/typescript.rs`.
  Moved and deleted in Milestone 4.
- Frame code in `packages/viewer/src/client` and
  `packages/viewer/src/inspector` → the `@mokly/frame` package. Consumers:
  about 30 viewer source files, `packages/viewer/src/index.ts`, the viewer
  build scripts, the frame tests under `packages/viewer/tests`, the root
  tests, helpers, and browser specs that import the frame code, four lint
  tests, and `scripts/verification/prepared.mjs`. Moved in Milestones 6
  and 7. Deleted in Milestone 7.
- The inspector names → the frame probe names of the **Design** section.
  Consumers: the static build in `crates/mokly-static`, the asset check in
  `crates/mokly-server/src/assets.rs`, the Rust tests and snapshots that
  name `inspector.js` or the markers, the TypeScript tests, the 13 files
  that link the two inspector protocol docs, and the build error for a
  consumer-authored `data-mokly-inspector-link`. Renamed in Milestone 6.
  There is no converter. Pages published before the rename must be
  published again, as decision 3 accepts.

## Decisions

### Answered

- **Decision 2, 2026-11-03: move the frame code to a new lockstep
  package.** The user chose C. The alternatives were A, keep the code in the
  viewer with the boundary as a convention, and B, add an import-rule zone
  in the viewer. Reason: a package boundary stops each import of viewer
  internals at the compiler, which a lint only finds.
- **Decision 4, 2026-11-03: put the shared model code in a lockstep model
  package.** The user chose B. The alternatives were A, move the model code
  into `@mokly/frame`, C, give the frame package its own inputs, D, let the
  viewer pass the rules in, and E, build one private source into each
  package. The agent recommended A, because the shared code is small. The
  user chose B, so that each rule has one home that later packages can use.
  The user questioned the name `@mokly/model`, and decision 5 kept it.
- **Decision 1, 2026-11-03: share one event runtime between both frame
  adapters.** The user chose B. The alternatives were A, change nothing, C,
  always use `postMessageAdapter` with a second real origin, D, always use
  `postMessageAdapter` with an opaque-origin sandbox, E, share only the pick
  path, and F, find drift with a browser spec. Reason: one runtime removes
  the drift, and the two runtimes already differ on hover.
- **Decision 3, 2026-11-03: rename the in-frame inspector, published names
  included.** The user chose C, with the name "frame probe". The
  alternatives were A, keep the name, B, rename the code only, D, qualify
  both names, and E, rename the inspector panel. Reason: the project is not
  in production, and this plan already moves every file of the script.
- **One plan, 2026-11-03.** The user asked for one plan. The shared event
  runtime first had its own plan, which ran after the move. This plan now
  holds both, and the runtime merge comes first.
- **Decision 6, 2026-11-03: hover names the instance that a click at the
  same point would report.** The user chose F. During a highlight or a pick,
  hover and click report only the highlighted or pickable keys. When
  instances nest, the innermost instance under the pointer wins, for hover
  and for click. The alternatives were A, hover reports every instance, B,
  the same key rule without the nesting rule, C, every instance during an
  idle highlight, D, an idle highlight is only a drawing, and E, remove
  hover. Reason: hover then matches click in every mode, the in-frame
  inspector already uses the key rule, and the shared runtime needs a
  nesting rule.
- **Decision 5, 2026-11-03: the model package is `@mokly/model`.** The user
  chose A. The alternatives were B, `@mokly/data`, C, `@mokly/catalogue`,
  D, `@mokly/contract`, E, `@mokly/model` with one subpath for each job,
  and F, `@mokly/data` with the whole `@mokly/viewer/data` entry. Reason:
  the package and the Rust crate `mokly-model`, which writes its types,
  share one name.

## Design

These are design calls of the planning agent, made on 2026-11-03.

### Order

- The runtime merge comes before the move. The move then carries one event
  runtime, and the code that the merge deletes never moves. The merge also
  deletes the last frame users of the hand-written `ComponentViewRecord`, so
  the frame package needs no copy of that viewer type.
- The runtime track, Milestones 2 and 3, and the package track, Milestones
  4 and 5, do not depend on each other. They join at Milestone 6.

### Shared event runtime

- The runtime splits into a transport-free core and a wire wrapper. The core
  has direct methods for list, highlight, scroll-to, subscribe, and dispose,
  and it reports events through a callback. The in-frame entry wraps the
  core with the wire messages. The same-origin adapter calls the core
  directly on the frame window.
- The core takes the link classifier as a parameter. The in-frame entry
  passes the classifier of its inert link map. The same-origin adapter
  passes the `data-mokly-link` classifier of `same_origin_navigation.ts`,
  because served pages stay byte-unmodified and have no link map.
- The core takes its observer and timer constructors as a parameter. A
  script-disabled frame may not run callbacks of its own realm, so the
  same-origin adapter passes the viewer window.
- The same-origin pick hit-tests the boundary list of the shared reader,
  with the nesting rule of decision 6. `visibleFrameBox` stays in the
  viewer.
- The in-frame script stays within its 9,216-byte budget. It has 955 bytes
  left on 2026-11-03. If the core does not fit, stop and ask the user,
  because a larger budget changes a protocol requirement.

### Packages

- The frame package is `@mokly/frame` under `packages/frame`. The model
  package is `@mokly/model` under `packages/model`, as decision 5 says.
  File names stay snake_case, as `AGENTS.md` says for every package except
  `@mokly/ui`.
- Both packages release in lockstep. `@mokly/frame` pins the exact version
  of the model package. `@mokly/viewer` pins the exact versions of both.
  The viewer is compiled with `tsc`, so it can depend only on published
  packages.
- The model package holds only the model code that the frame package needs:
  the path and link grammar of `logical.ts`, `currentDocumentPath` with its
  inverse `currentDocumentRoute`, `RENDERS_PATH`, `RENDER_ID`, the data
  paths, the namespace constants, and the generated types. The routes and
  the prop schema validators stay in the viewer. `@mokly/viewer/data` keeps
  every export and re-exports the moved ones from the model package only.
- The frame package holds both sides of the probe: the adapter interface,
  `sameOriginAdapter`, `temporaryPreviewAdapter`, `postMessageAdapter`, the
  message transport, the wire schema, the measuring code, the shared event
  core, and the frame probe. Both ends of the wire protocol and their shared
  code then stay together.
- The functions that only the frame code calls move with it:
  `frameLinkActivation`, `parseLogicalMarker`, `logicalMarker`, and all of
  `navigation/target.ts`. The shell keeps `eligibleAnchor`.
- `@mokly/viewer` re-exports the public adapters and frame types. Hosts
  import them only from the viewer. The frame code keeps state in
  module-level maps, such as `frame_mount.ts`, `frame_session.ts`, and
  `same_origin_identity.ts`. Two installed copies would split these maps.
- The frame package has one internal subpath, `@mokly/frame/internal`, for
  the parts that only the viewer uses: the frame session registry,
  `FrameError`, `frameUsage`, `cancelFrameMount`, `localFramePath`,
  `temporaryPreviewAdapter`, `clipNode`, and the rectangle helpers. The
  shell's session data stays out of the public `FrameMount` interface, as
  `frame_session.ts` intends.
- Shell-only helpers stay in the viewer: `cleanup.ts`, `inspection_work.ts`,
  and `visibleFrameBox`. No frame code uses them.
- The frame package builds `frame-probe.js`. The viewer build copies it into
  `packages/viewer/dist/browser` and its browser manifest.
- Unit tests move with the code to the new packages. Root tests import the
  `dist` directory of the package. Browser specs stay in `tests/browser`,
  because they need the whole viewer.
- No new lint zone. The `tsc` build of each package sets `rootDir` to its
  `src`, so it rejects a relative import into another package.

### Frame probe names

- The source directory is `packages/frame/src/probe`. The entry functions
  are `probeRuntime`, `probeNavigation`, and `bundleProbe`, and the metadata
  type is `ProbeMetadata`.
- The published script is `mokly-viewer/client/frame-probe.js`.
- The message channel is `mokly-frame-probe`, and the wire version goes from
  2 to 3, so that an old page and a new viewer reject each other clearly.
- The page markers are `template[data-mokly-frame-probe]` and
  `data-mokly-frame-probe-link`.
- The Rust modules are `crates/mokly-static/src/frame_probe.rs` and
  `frame_probe_error.rs`.
- The protocol docs become `docs/protocol/mokly-frame-probe.md` and
  `docs/protocol/mokly-frame-probe-wire.md`.
- The inspection feature and the inspector panel keep their names.

### Calls from Milestone 1

These are design calls of the orchestrator, made on 2026-11-03, for the
items that the Milestone 1 docs agent raised. None changes a requirement.

- Milestone 4 repoints the protocol links to the generated types, because
  the types move there.
- The protocol pages that still name the in-frame inspector change in
  Milestone 1. READMEs and follow-up items change with their code in
  Milestone 6.
- Milestone 6 adds the republish step to the upgrade guide, because the
  release contract makes the guide the home of upgrade steps.
- The status line of `docs/protocol/npm-bootstrap.md` stays after the
  merge and links the registration follow-up item, because the
  registration happens after the merge.
- No rule for instances that overlap without nesting. The measured boxes
  already exclude areas that other content covers, so only the visible
  instance contains a point.
- Each new package gets the `CHANGELOG.md` stub of `@mokly/ui`.

## Milestone 1: Documentation and protocol

Depends on: none.

The docs state the shared runtime, the packages, their boundaries, their
release, and the frame probe names before the code changes.

- [x] Add `docs/protocol/mokly-frame-package.md` and
      `docs/protocol/mokly-model-package.md`, each with a status line that links this plan. State
      each package, its entries, the re-exports by the viewer, the rule that
      a package never imports the viewer, the CLI, or consumer code, the
      exact lockstep pins, and the decisions with their reasons.
- [x] Rename `docs/protocol/mokly-published-inspector.md` and
      `docs/protocol/mokly-inspector-wire.md` to the frame probe docs. State
      the new script path, channel, wire version 3, and page markers, with
      a status line. Update every link to them.
- [x] Update `docs/protocol/mokly-frame-adapter.md`: `@mokly/frame` defines
      the interface and the built-in adapters, `@mokly/viewer` re-exports
      them, both built-in adapters run one event runtime, and every adapter
      follows the hover rule of decision 6.
- [x] State the hover rule of decision 6 in
      `docs/protocol/mokly-viewer-selection.md`.
- [x] Update `docs/architecture/package-boundary.md`, which says that the
      viewer owns the frame adapters and the in-frame inspector.
- [x] Update `docs/protocol/npm-bootstrap.md`, `npm-release.md`,
      `npm-release-management.md`, and `npm-github-protections.md` with the
      registration, the publication order, and the trust of each new
      package.
- [x] Update `docs/protocol/packed-consumer-smoke.md`,
      `docs/protocol/developer-test-commands.md`,
      `docs/protocol/developer-type-checks.md`, and
      `docs/protocol/ci-verification-repository.md`.
- [x] Update `AGENTS.md`, `README.md`, and `scripts/release/README.md` with
      the package list and the build order.

## Milestone 2: Shared event core

Depends on: 1.

The in-frame inspector runs on the new core, with the same wire behaviour
and the hover rule of decision 6. The code is still in the viewer.

- [x] Split `inspectorRuntime` in `packages/viewer/src/inspector/runtime.ts`
      into the core and the wire wrapper of the **Design** section.
- [x] Apply the hover rule and the nesting rule of decision 6 in the core.
- [x] Keep the in-frame script within its budget. Run its budget test.

## Milestone 3: Same-origin adapter on the core

Depends on: 2.

The same-origin adapter uses the core, and the duplicated code goes.

- [x] Run the core from `same_origin_mount.ts` and `same_origin_adapter.ts`
      with the link classifier and the viewer window.
- [x] Move the tests of the old same-origin event code to the core, with
      every assertion. Move `tests/browser/frame_clipping.spec.ts` from
      `rangeBounds` to the shared reader.
- [x] Delete the same-origin event code of the **Replaced ways** list.
      Record the searches that prove each part unused.
- [x] Add a browser test for hover and nested instances during a highlight
      and a pick on both adapters. Run it 10 times.

## Milestone 4: Model package

Depends on: 1.

The model code moves out of the viewer into `@mokly/model`.

- [x] Create `packages/model` with `package.json`, `tsconfig.json`,
      `tsconfig.build.json`, a build script, `README.md`, `LICENSE`, and the
      `CHANGELOG.md` stub of `@mokly/ui`.
      Wire it into the root workspaces, the build order, the test runner,
      the typecheck runner, the checks in `xtask/src/check/commands.rs`,
      the release scripts and their registration in `bootstrap.mjs`,
      `release-please-config.json`, the release manifest, the
      packed-consumer smoke test, and the two workflows under
      `.github/workflows`.
- [x] Move the model code of the **Design** section, with its tests.
- [x] Point `cargo xtask generate-types` and its tests at the package.
      Change the import that `crates/mokly-model/src/typescript.rs` adds to
      `RenderCapability.ts`.
- [x] Repoint the links of the protocol pages to the generated types, about
      22 links in 15 pages, and the output folder that
      `crates/mokly-model/README.md` names, to `packages/model`.
- [x] Move every viewer consumer to the package. Re-export the moved
      functions from `@mokly/viewer/data`. Delete the old modules.

## Milestone 5: Frame package skeleton

Depends on: 4.

The empty frame package builds, tests, and packs with the other packages.

- [x] Create `packages/frame` with `package.json`, `tsconfig.json`,
      `tsconfig.build.json`, a build script, `README.md`, `LICENSE`, and the
      `CHANGELOG.md` stub of `@mokly/ui`.
- [x] Wire it in the same places as the model package in Milestone 4.

## Milestone 6: Move the inspector and rename it to the frame probe

Depends on: 3 and 5.

The in-frame inspector, the shared event core, the wire schema, and the
measuring code move into the frame package under the frame probe names. The
Rust static build and server use the new names in the same milestone, so
that the product works. The host adapters stay in the viewer for one
milestone and import from `@mokly/frame/internal`.

- [x] Move `packages/viewer/src/inspector`,
      `packages/viewer/src/client/frame_adapter.ts`, the frame-only
      functions of the **Design** section, and the scripts
      `inspector-bundle.mjs`, `inspector-pool.mjs`, and
      `inspector-pool.d.mts` with `git mv`. Rename them to the frame probe
      names.
- [x] Build `frame-probe.js` in the package. Copy it in the viewer build
      into `packages/viewer/dist/browser` and the browser manifest.
- [x] Rename the channel, the wire version, and the page markers. Rename the
      Rust modules, the injected script path, the reserved-marker build
      error, and the asset check in `crates/mokly-server/src/assets.rs`.
      Update their tests and snapshots.
- [x] Add the republish step of the rename to
      `docs/guides/start/upgrade.md`. Update the READMEs and follow-up items
      that name the old script: `packages/viewer/docs/deployment/README.md`,
      `packages/viewer/README.md`, and the items under `plans/follow-ups/`
      that name `inspector.js`.
- [x] Move `packages/viewer/tests/inspector_budget.test.ts` and
      `marker_ranges.test.ts`. Point `tests/inspector_inert.test.ts`,
      `tests/inspector_schema.test.ts`, and `tests/inspector_pool.test.ts`
      at the package, and rename them to the frame probe.

## Milestone 7: Move the host adapters

Depends on: 6.

The host adapters move into the frame package. The viewer imports the
package only through its exports.

- [x] Move `packages/viewer/src/client` with `git mv`, except `cleanup.ts`,
      `inspection_work.ts`, and `visibleFrameBox`, which move to
      `packages/viewer/src/shell`.
- [x] Re-export the public adapters and frame types from
      `packages/viewer/src/index.ts`. Move each viewer consumer to
      `@mokly/frame` or `@mokly/frame/internal`.
- [x] Move the frame unit tests from `packages/viewer/tests` to
      `packages/frame/tests`. Point the root tests, helpers, browser specs,
      `scripts/verification/prepared.mjs`, and the lint tests at the
      package.
- [x] Move the client and inspector READMEs into the package README. Delete
      the old directories. Remove the status lines that Milestone 1 added,
      except on `docs/protocol/npm-bootstrap.md`, which stays until the
      registration.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone.

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [x] Run the mockup check named in `AGENTS.md`, and smoke-test local Browse
      through `npm run dev`: hover, pick, Escape, nested instances, and
      catalogue links in a screen and a component page.
- [x] Commit with Conventional Commits and push the branch. Mark the rename
      of the published names as a breaking change, so that the release notes
      ask for a new publication of each catalogue.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan". Point the status line of `docs/protocol/npm-bootstrap.md` at
      the follow-up item of the registration.
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] A maintainer registers each new package with
      `scripts/release/bootstrap.mjs` before the next release pull request
      merges.
- [ ] Tell Mokly Cloud about its next pin bump: `@mokly/viewer` brings both
      new packages, its imports do not change, its contract fixtures must
      name `frame-probe.js`, and each catalogue must be published again.
