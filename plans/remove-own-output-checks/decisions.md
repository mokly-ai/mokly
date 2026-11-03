# Decisions of the own-output checks plan

This file belongs to [the plan](../remove-own-output-checks.md). It records
the user decisions and my design calls with their dates.

## User decisions

### 2026-11-03: Check data once, where it enters

- **Choice:** option B. Mokly checks data once, where it enters from outside,
  and trusts what its own code of the same version produced. The core no
  longer checks its own output before it writes it. The viewer keeps only
  the version gates and the fences. The Rust readers stay only as Mokly
  Cloud's upload check, because an uploaded index is untrusted. Mokly Cloud
  can depend on the Mokly core.
- **Alternatives:**
  - A: also delete the Rust readers. The viewer keeps a few security checks,
    and Mokly Cloud changes nothing. Rejected, because Mokly Cloud must check
    uploads.
  - D: option G of `plans/viewer-checks-from-rust.md` as written, where the
    core also keeps checking its own output. Rejected, because that check
    guards only against Mokly's own bugs.
  - C: keep the checks with one shared implementation through wasm2js,
    decision F of 2026-11-01. Superseded: the user chose G over F in
    workspace 461 on 2026-11-03, after a trial showed that F adds about
    1.23 MB gzip and reads the large index in 26 s.
  - Left out: trust all data with no security check and no Cloud check,
    checks only in tests and development builds, removal in the viewer only,
    and generated TypeScript readers.
- **Reason:** the copies drift and make valid catalogues unreadable. About
  6,300 lines of checks and 4,700 lines of tests guard only against
  Mokly's own bugs.

### 2026-11-03: Delete `privacy.ts`

- **Choice:** option D. Delete `packages/viewer/src/catalogue/privacy.ts`
  with the other viewer checks, in the other plan. The typed Rust
  projection writes only the fields that the public types declare.
- **Alternatives:** A, an exemption below `before` and `after` only inside
  `inputChanges`. B, prop maps renamed to `beforeProps` and `afterProps`. C,
  a list of author-data places generated from the Rust types.
- **Reason:** the check guards against a Rust bug that the typed structs
  prevent, and its `before` exemption let private keys pass.

### 2026-11-03: Agent rules

The user changes the shared `typescript` and `rust` skills in
`futex-ai/skills`. This repository gets no rule change. Milestone 10 waits
for the `rust` skill change.

### 2026-11-03: Two workspaces in parallel

The user asked whether to combine the work in one workspace. I recommended
parallel work in workspaces 461 and 463, split by area, because the parts
change different files apart from three shared points. The user agreed and
asked me to send the scope note to workspace 461.

## My design calls, 2026-11-03

1. Keep the version gates, the fences, the sidecar hello and version gate,
   and the frame size limits. They handle real version differences, live
   races, and memory limits.
2. Keep the boundary part of each mixed check, and remove only its
   own-output part.
3. Do not move the removed rules into tests. The typed Rust structs and the
   behaviour tests stay the safety net.
4. Add no new author checks in Rust for values that only the viewer
   rejected, such as a `relatedDocs` value with `:` or a use case without
   steps. The core's rules decide what is valid. A new rejection needs the
   user.
5. Keep `crates/mokly-css/src/module_integrity.rs`. It catches author CSS
   that the renamer cannot scope, as
   `plans/follow-ups/css-module-bare-wrapper-kind.md` shows.
6. Keep `crates/mokly-html/src/fragment_validation.rs`, except its dead
   duplicate-key branch. Author code shares the sidecar process and can
   forge instance records, and `docs/protocol/mokly-instances.md` requires
   a failure on forged markers.
7. Keep the wrapper's `validateProps`, which checks author props before the
   adapter runs. Remove its `validatePropSchema` call, because the core
   checked the schema before any render. The other plan owns the choice of
   the props checker in Node.
8. Keep the wrapper's registration path check. A link to the root folder
   definition has the path `""`, which an author can write.
9. Replace each poisoned-lock error with `PoisonError::into_inner` now.
   Milestone 10 turns serialization that cannot fail into `expect` after the
   `rust` skill allows it.
10. Make `compiled` required. The replay that bundles again from disk never
    runs, and `docs/protocol/mokly-sidecar-modules.md` forbids it.
11. This workspace takes the core's second checks of its own output and the
    viewer shell guards in files that the other plan does not change, so
    that the other plan's scope does not grow. The branch that merges second
    resolves the shared lines in `mokly-component-props.md`,
    `mokly-catalogue-serialization.md`, and `crates/mokly-model`.
12. The other plan keeps the `@mokly/viewer/data` exports `validateProps`,
    `isLinkPath`, and `isLogicalFragment`, because `@mokly/mokly` uses them
    to check author input.

13. Retain typed ownership and upload metadata in each finalized artifact.
    Publication reuses those records instead of parsing its own bytes.
    Parsing of persisted output directories stays.
14. Capture a compilation seed's complete recipe under the pool lock.
    The seed can receive its final release before restoration finishes.
    The retained snapshot keeps this real race safe without a guard.
15. Expose owned-style instance selection on its production attribution
    path. Tests keep exact component and instance assertions there.
    Impact records retain only component and reason after self-validation
    metadata becomes unused.
16. Keep generic serializers fallible when their public contract accepts
    arbitrary Rust serializers. Concrete Mokly callers state their proven
    invariant. Private application encoders trust their closed caller set.
    Keep the bundle cache key's filesystem-path failure.
17. Apply the approved narrow guards in shared delivery files here.
    Workspace 461 owns their reader rewrites and merges this branch before
    its final gate. The integration note names the shared files.

18. Retain the existing 64 MiB ownership marker limit at its writer.
    A large catalogue is an external resource boundary. Its marker must
    remain readable on the next build without a second parse here.
