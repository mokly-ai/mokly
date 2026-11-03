# Frame package

Status: Active. On branch `calummoore/viewer-inspector-purpose`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

The frame code lives inside `@mokly/viewer`. It is the frame adapters under
`packages/viewer/src/client` and the in-frame inspector under
`packages/viewer/src/inspector`, about 3,300 lines. Nothing stops this code
from importing viewer internals, so its boundary is only a convention. This
change moves the frame code into a new lockstep package, `@mokly/frame`. It
moves the catalogue rules and types that the frame code shares with the
viewer into a second new lockstep package, the model package. It renames
the in-frame inspector to the frame probe, published names included. The
Rust half of the probe contract stays in `crates/mokly-static` and
`crates/mokly-server`. The change does not merge the two event runtimes.
[The frame event runtime plan](./frame-event-runtime.md) does that after
this plan. The change does not accept new host origins, such as the
`mokly-app://desktop` origin of Mokly Cloud.

Contract owners:

- `docs/protocol/mokly-frame-package.md` and the model package contract,
  which Milestone 1 adds.
- The [viewer frame adapter](../docs/protocol/mokly-frame-adapter.md).
- The [published inspector](../docs/protocol/mokly-published-inspector.md)
  and the [inspector wire protocol](../docs/protocol/mokly-inspector-wire.md),
  which Milestone 1 renames to the frame probe.
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
- Model code in the viewer → the model package. Consumers: the frame code,
  the viewer files that use the path and link grammar, the delivery paths,
  the data paths, and the generated types, `@mokly/viewer/data`,
  `cargo xtask generate-types`, and `crates/mokly-model/src/typescript.rs`.
  Moved and deleted in Milestone 2.
- The inspector names → the frame probe names of the **Design** section.
  Consumers: the static build in `crates/mokly-static`, the asset check in
  `crates/mokly-server/src/assets.rs`, the Rust tests and snapshots that
  name `inspector.js` or the markers, the TypeScript tests, the 13 files
  that link the two inspector protocol docs, and the build error for a
  consumer-authored `data-mokly-inspector-link`. Renamed in Milestone 4.
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
  The user questioned the name `@mokly/model`. Decision 5 below asks for
  the name.
- **Decision 1, 2026-11-03: share one event runtime between both frame
  models.** The user chose B. The alternatives were A, change nothing, C
  and D, always use `postMessageAdapter`, E, share only the pick path, and
  F, find drift with a browser spec. Reason: one runtime removes the drift,
  and the two runtimes already differ on hover. The work has its own plan,
  [the frame event runtime plan](./frame-event-runtime.md), which runs after
  this plan.
- **Decision 3, 2026-11-03: rename the in-frame inspector, published names
  included.** The user chose C, with the name "frame probe". The
  alternatives were A, keep the name, B, rename the code only, D, qualify
  both names, and E, rename the inspector panel. Reason: the project is not
  in production, and this plan already moves every file of the script.

### 5. The model package needs a name

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** None. The package does not exist yet.
- **Terms:**
  - **Model package:** the new lockstep package of decision 4. It holds the
    generated catalogue types, the path and link grammar, the delivery
    paths, and the data paths that the frame package and the viewer share.
- **Background:**
  - The Rust crate `mokly-model` writes every generated type and owns the
    Rust path grammar in `crates/mokly-model/src/paths.rs`. Its README calls
    its shapes pure data contracts. The crate is not published.
  - The Rust crate `mokly-catalogue` loads the configuration and prepares a
    catalogue. That is a different job.
  - The protocol docs use "catalogue model" and "read model" for defined
    things, and "contract" for a protocol doc, with about 860 uses in 157
    docs.
  - `@mokly/viewer/data` already exports the path grammar and the delivery
    paths. `@mokly/mokly` imports them from there.
  - The other new names are `@mokly/frame` and the frame probe.
  - Each candidate name is free on npm. A name is public after the npm
    registration. A new name then needs a new package.
- **Problem:** The plan calls the package `@mokly/model`, and the user
  questions that name.
- **Impact if no action:** Milestones 1 and 2 cannot name the package.
- **Root question:** Which name tells a reader what belongs in the package,
  and what does not?
- **Options:**
  - **A.** `@mokly/model`. It mirrors the Rust crate `mokly-model`, which
    owns the same shapes and grammar. The word is broad, and on npm it can
    read as an AI model. Hosts keep importing `@mokly/viewer/data`, so few
    readers see the name. Effort: Small.
  - **B.** `@mokly/data`. It matches the public entry `@mokly/viewer/data`.
    The word is generic. The package holds only part of that entry, so the
    two names cover different sets. Effort: Small.
  - **C.** `@mokly/catalogue`. It names the domain of the types and rules.
    The Rust crate `mokly-catalogue` does a different job, and the catalogue
    readers stay in the viewer, so the name promises more than the package
    holds. Effort: Small.
  - **D.** `@mokly/contract`. It names the role, the published data
    contract. In this repository "contract" means a protocol doc, so the
    name reads as "all the contracts". Mokly Cloud also uses it for its
    upload validator crate `mkc-mokly-contract`. Effort: Small.
  - **E.** `@mokly/model` with one subpath for each job and no root entry,
    as `@mokly/ui` has one subpath for each component. For example,
    `@mokly/model/paths` holds the grammar and the paths, and
    `@mokly/model/types` holds the generated types. Each import then names
    its job, and a new job needs a new subpath that a reviewer sees. The npm
    name stays broad. Effort: Small.
  - **F.** `@mokly/data`, and the package takes the whole
    `@mokly/viewer/data` entry, with the routes and the prop schema
    validators. The package then holds the same set as the entry that
    `@mokly/mokly` imports today. About 760 more lines move with their
    tests, and this reverses the design call that moves only what the frame
    package needs. Effort: Medium.
- **Left out:** Each of these fails the goal:
  - `@mokly/core` collides with "the Rust core" of `AGENTS.md`.
  - `@mokly/types` says types only, but the package holds runtime code.
  - `@mokly/schema` collides with the prop schemas and
    `config.schema.json`.
  - `@mokly/shared` and `@mokly/common` name no job, so unrelated code
    collects in them.
  - `@mokly/format` collides with the `format` script.
  - `@mokly/catalogue-model` and `@mokly/read-model` name defined things
    of the protocol docs that the package does not hold.
  - `@mokly/protocol`, `@mokly/wire`, and `@mokly/spec` collide with
    `docs/protocol`, the frame probe wire, and the mockup `specs`
    directories.
  - `@mokly/paths` says paths only, but most of the package is types.
- **Wider fix:** None. This is one name.
- **Previous examples:** `@mokly/ui` names its job and has one subpath for
  each component. Each Rust crate name starts with `mokly-` and names its
  job.
- **Related:** Decision 4 chose the package. Milestones 1 and 2 wait for
  this decision.
- **Recommendation:** A. The TypeScript package and the Rust crate that
  writes its types then share one name. Each other word means another
  defined thing here, or is generic. If "model" is too broad for you, E
  keeps the name and names the job at each import.
- **Action:** ask the user, because the user asked for the options, and the
  name is public after the npm registration.

## Design

These are design calls of the planning agent, made on 2026-11-03.

- The frame package is `@mokly/frame` under `packages/frame`. The model
  package lives under `packages/{name}`, with the name of decision 5. The
  user can change a name before the npm registration. File names stay
  snake_case, as `AGENTS.md` says for every package except `@mokly/ui`.
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
- The frame package declares its own record type for the same-origin pick,
  with only the ranges and the viewport that it reads. It does not import
  the hand-written `ComponentViewRecord` of
  `packages/viewer/src/components/view_types.ts`. The frame event runtime
  plan later deletes this record.
- The frame package holds both sides of the probe: the adapter interface,
  `sameOriginAdapter`, `temporaryPreviewAdapter`, `postMessageAdapter`, the
  message transport, the wire schema, the measuring code, and the frame
  probe. Both ends of the wire protocol and their shared measuring code
  then stay together.
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
- The frame probe names:
  - The source directory is `packages/frame/src/probe`. The entry functions
    are `probeRuntime`, `probeNavigation`, and `bundleProbe`, and the
    metadata type is `ProbeMetadata`.
  - The published script is `mokly-viewer/client/frame-probe.js`.
  - The message channel is `mokly-frame-probe`, and the wire version goes
    from 2 to 3, so that an old page and a new viewer reject each other
    clearly.
  - The page markers are `template[data-mokly-frame-probe]` and
    `data-mokly-frame-probe-link`.
  - The Rust modules are `crates/mokly-static/src/frame_probe.rs` and
    `frame_probe_error.rs`.
  - The protocol docs become `docs/protocol/mokly-frame-probe.md` and
    `docs/protocol/mokly-frame-probe-wire.md`.
  - The inspection feature and the inspector panel keep their names.
- The frame package builds `frame-probe.js`. The viewer build copies it into
  `packages/viewer/dist/browser` and its browser manifest.
- Unit tests move with the code to the new packages. Root tests import the
  `dist` directory of the package. Browser specs stay in `tests/browser`,
  because they need the whole viewer.
- No new lint zone. The `tsc` build of each package sets `rootDir` to its
  `src`, so it rejects a relative import into another package.

## Milestone 1: Documentation and protocol

Depends on: none. The model package parts wait for decision 5.

The docs state the packages, their boundaries, their release, and the frame
probe names before the code moves.

- [ ] Add `docs/protocol/mokly-frame-package.md` and the contract of the
      model package, each with a status line that links this plan. State
      each package, its entries, the re-exports by the viewer, the rule that
      a package never imports the viewer, the CLI, or consumer code, the
      exact lockstep pins, and the decisions with their reasons.
- [ ] Rename `docs/protocol/mokly-published-inspector.md` and
      `docs/protocol/mokly-inspector-wire.md` to the frame probe docs. State
      the new script path, channel, wire version 3, and page markers, with
      a status line. Update every link to them.
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

## Milestone 2: Model package

Depends on: 1. It waits for decision 5.

The model code moves out of the viewer into its own package.

- [ ] Create the package with `package.json`, `tsconfig.json`,
      `tsconfig.build.json`, a build script, `README.md`, and `LICENSE`.
      Wire it into the root workspaces, the build order, the test runner,
      the typecheck runner, the checks in `xtask/src/check/commands.rs`,
      the release scripts and their registration in `bootstrap.mjs`,
      `release-please-config.json`, the release manifest, the
      packed-consumer smoke test, and the two workflows under
      `.github/workflows`.
- [ ] Move the model code of the **Design** section, with its tests.
- [ ] Point `cargo xtask generate-types` and its tests at the package.
      Change the import that `crates/mokly-model/src/typescript.rs` adds to
      `RenderCapability.ts`.
- [ ] Move every viewer consumer to the package. Re-export the moved
      functions from `@mokly/viewer/data`. Delete the old modules.

## Milestone 3: Frame package skeleton

Depends on: 2.

The empty frame package builds, tests, and packs with the other packages.

- [ ] Create `packages/frame` with `package.json`, `tsconfig.json`,
      `tsconfig.build.json`, a build script, `README.md`, and `LICENSE`.
- [ ] Wire it in the same places as the model package in Milestone 2.

## Milestone 4: Move the inspector and rename it to the frame probe

Depends on: 3.

The in-frame inspector, the wire schema, and the measuring code move into
the frame package under the frame probe names. The Rust static build and
server use the new names in the same milestone, so that the product works.
The host adapters stay in the viewer for one milestone and import from
`@mokly/frame/internal`.

- [ ] Move `packages/viewer/src/inspector`,
      `packages/viewer/src/client/frame_adapter.ts`, the frame-only
      functions of the **Design** section, and the scripts
      `inspector-bundle.mjs`, `inspector-pool.mjs`, and
      `inspector-pool.d.mts` with `git mv`. Rename them to the frame probe
      names.
- [ ] Build `frame-probe.js` in the package. Copy it in the viewer build
      into `packages/viewer/dist/browser` and the browser manifest.
- [ ] Rename the channel, the wire version, and the page markers. Rename the
      Rust modules, the injected script path, the reserved-marker build
      error, and the asset check in `crates/mokly-server/src/assets.rs`.
      Update their tests and snapshots.
- [ ] Move `packages/viewer/tests/inspector_budget.test.ts` and
      `marker_ranges.test.ts`. Point `tests/inspector_inert.test.ts`,
      `tests/inspector_schema.test.ts`, and `tests/inspector_pool.test.ts`
      at the package, and rename them to the frame probe.

## Milestone 5: Move the host adapters

Depends on: 4.

The host adapters move into the frame package. The viewer imports the
package only through its exports.

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
      the old directories. Remove the status lines that Milestone 1 added.

## Milestone 6: Verification, commit, review, and pull request

Depends on: every other milestone.

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Run the mockup check named in `AGENTS.md`, and smoke-test local Browse
      through `npm run dev`: hover, pick, Escape, and catalogue links in a
      screen and a component page.
- [ ] Commit with Conventional Commits and push the branch. Mark the rename
      of the published names as a breaking change, so that the release notes
      ask for a new publication of each catalogue.
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
- [ ] Tell Mokly Cloud about its next pin bump: `@mokly/viewer` brings both
      new packages, its imports do not change, its contract fixtures must
      name `frame-probe.js`, and each catalogue must be published again.
