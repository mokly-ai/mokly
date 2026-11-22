# Sidecar answers hello only after its session load

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, after the performance
  orchestrator closed the light-sidecar-entry experiment on 2026-11-22.
- **Location:** `packages/mokly/src/sidecar.ts`, the sidecar entry, which
  loads every session module before it reads `hello`.
  `crates/mokly-sidecar/src/pool.rs`, `Pool::spawn`, which waits for `hello`.
  `crates/mokly-sidecar/src/pool_bundle_cache.rs`, `Pool::seed_bundle`, which
  reads the bundle cache after `hello`.
  `crates/mokly-sidecar/src/pool_return_spawn.rs`, the return pass.
- **Reason:** The official mokly-cloud check of the last form failed on
  2026-11-22, and the orchestrator closed the experiment, so no work follows.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Session modules:** the sidecar modules that bundle, describe, and
    render: 114 files with esbuild, Babel, parse5, PostCSS, and the viewer
    data. They load in about 65 ms in a quiet process.
  - **Light entry:** a sidecar entry that loads only the transport, the stdin
    reader, the timings, and `PostcssWorkers`, 18 files in about 10 ms, and
    loads the session modules later with a dynamic import.
  - **Early answer:** a `hello` reply that comes before the session load.
  - **Return pass:** the pool work that switches an idle base-side sidecar
    back to the head root. It starts a fresh sidecar outside any request.
  - **A/A control:** an arm with the same core and dist as `main`, at another
    path with its own bundle cache.
- **Background:**
  - A new sidecar loads all its session modules before it reads `hello`. The
    pool waits for `hello`, then sends `prepareContext` when the request has
    a PostCSS preparation, then reads the bundle cache and sends the seed.
  - Node loads ES modules synchronously, so a session load blocks the main
    thread of the sidecar. A load before `hello` delays `hello`. A load
    directly after `hello` delays a `prepareContext` that arrives during it.
  - On a warm `examples/basic` start, the PostCSS child is ready about 430 ms
    after its fork: about 145 ms of child boot and 150 to 185 ms of
    configuration load. After the first stylesheet, 38 serial `processCss`
    requests take most of `serve.ready`, as `basic-stylesheet-chain.md`
    says.
  - Four throwaway prototypes tested an earlier `hello` on 2026-11-22. The
    sections below give the method, the numbers, and the two official checks
    of the orchestrator.
  - No form gained beyond noise on both fixtures. The official check of the
    last form, E, found no mokly-cloud gain: `serve.ready` +18 ms on the mean
    and 0 ms on the median over 8 pairs.
- **Problem:** A new sidecar answers `hello` only after its session load, and
  the bundle work of its request waits for that answer. An earlier answer did
  not shorten a warm start, because the work after `hello` takes about as long
  as the load that it no longer waits for.
- **Impact if no action:** Small. On mokly-cloud the early answer moved the
  first `sidecar.spawn` span from 123 ms to 61 ms, but the end of the first
  `catalogue.bundle` only from 502 ms to 486 ms.
- **Root question:** How can a warm Serve start stop waiting for the full
  sidecar boot before its bundle work, without a slower PostCSS start or edit?
- **Options:**
  - **A.** Change nothing. This is the settled outcome of 2026-11-22. Effort:
    Small.
  - **B.** Prototype 1: a light entry that answers `hello` and
    `prepareContext`, forks the child, and then loads. Effort: Large.
  - **C.** Prototype 2, called C0: an early answer for every new sidecar.
    Effort: Large.
  - **D.** Prototype E: an early answer only when a request without a PostCSS
    preparation starts the sidecar. Effort: Large.
  - **E.** Prototype 3: the pool reads the bundle cache entry on a second
    thread while the new sidecar starts. Effort: Medium.
  - **F.** A faster session load, for example with the Node compile cache or
    a smaller module graph. This record holds no measurement of F. Effort:
    Medium.
- **Left out:**
  - A preparation inside `hello` or a spawn-time launch input: the fork moves
    at most about 30 ms more than in prototype 1, and the stylesheet chain
    absorbs most of that on basic. This is a projection.
  - A load at the entry, before `hello`: `hello` then waits for the load, and
    a 3-run smoke showed no earlier fork.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** #470 sent `prepareContext` before the bundle cache
  read. #464 added the startup preparation.
  [serve-head-generation-preload.md](./serve-head-generation-preload.md)
  records a similar result: earlier work cost about as much as it saved.
- **Related:**
  - [basic-stylesheet-chain.md](./basic-stylesheet-chain.md) holds the
    largest remaining part of a warm basic start.
  - [stylesheet-cache-across-restarts.md](./stylesheet-cache-across-restarts.md)
    is parked.
  - [closed-experiment-record-kind.md](./closed-experiment-record-kind.md)
    waits for the user on the kind and the home of experiment records, this
    record included.
- **Recommendation:** A. No measured form gained beyond noise on both
  fixtures, and the official check of E found no gain.
- **Action:** No action. The closure of 2026-11-22 is settled, and no current
  decision waits for the user. A later proposal that differs materially needs
  new evidence and its own scope approval.

## Fixture and method

- Machine of workspace 233: 4 vCPU, Linux, Node 24.22.1. Release cores, built
  with `--release --locked --package mokly-cli --bin mokly`.
- Fixtures: `examples/basic` with its PostCSS configuration, and the cloud
  catalogue of this repository, the root `mokly.config.json`, which builds
  `docs/mockups` without PostCSS. Serve ran with 2 sidecars.
- Each run was a warm restart. The harness waited until Changes were ready,
  the background pass ended, and the render store was idle. For `basic`, it
  then wrote one edit to
  `examples/basic/src/components/workspace-note/workspace-note.tsx`, waited
  for `watch.action`, and restored the file. Every run restored the exact
  source.
- One clock: a `--require` probe stamped the sidecar requests, the replies,
  the child forks, and the child phases. The core timing records were aligned
  by their arrival times.
- Each arm had its own bundle cache, because a dist change changes the
  toolchain identity. Pairs were in ABBA order. Three-arm sessions rotated the
  arm order in each block.
- The orchestrator ran its official checks on its own machine and its
  mokly-cloud fixture, with its own harness.

## Split on `main`

`main` 1a2534d03, `examples/basic`, 8 warm restarts after one cold start, ms
from the core start:

| Event                                         |  Time |
| --------------------------------------------- | ----: |
| Head sidecar process starts                   |    20 |
| `hello` reaches the sidecar                   |   142 |
| `prepareContext` reaches the sidecar          |   144 |
| PostCSS child fork                            |   146 |
| First `processCss` reaches the sidecar        |   399 |
| Child ready, configuration and plugins loaded |   574 |
| First `processCss` waits for the child        |   176 |
| `serve.ready`                                 | 1,640 |
| First Changes                                 | 5,127 |

The first edit after the restart and its restore, ms from the write. Both
writes ran on a fresh head sidecar, because a root-switch recycle started at
the write.

| Event                                  |     First edit |    Restore |
| -------------------------------------- | -------------: | ---------: |
| `prepareContext`, fork                 |       144, 146 |   138, 140 |
| Child ready                            |            645 |        592 |
| `bundle` request to reply              |   195 to 1,022 | 199 to 341 |
| First `processCss` to reply            | 1,057 to 1,105 | 355 to 617 |
| First `processCss` waits for the child |              0 |        237 |
| `watch.action` end                     |          1,589 |      1,053 |

## Prototype 1: light entry, fork first

The entry answered `hello` and `prepareContext`, forked the child, and then
loaded the session modules. Every other request waited for the load. The
first request after the load replayed `hello` into the session. 10 pairs on
`examples/basic`:

| Measure                     | `main` | Prototype 1 | Change | Faster |
| --------------------------- | -----: | ----------: | -----: | -----: |
| `hello` reaches the sidecar |    115 |          71 |    −44 |  10/10 |
| Child fork                  |    118 |          74 |    −44 |  10/10 |
| Child ready                 |    463 |         436 |    −27 |   7/10 |
| First stylesheet reply      |    485 |         461 |    −25 |   7/10 |
| `serve.ready`               |  1,284 |       1,292 |     +8 |   6/10 |
| First edit                  |  1,250 |       1,442 |   +191 |   2/10 |
| Restore                     |    763 |         777 |    +14 |   4/10 |

The session load ran beside the child start and slowed it. The edit was
slower, because its fresh sidecar answered `hello` about 70 ms before its
`prepareContext` arrived, waited idle, and loaded only after the fork.

## Prototype 2, C0: early answer for every start

The entry answered `hello` at once and started the session load directly
after the reply.

- Cloud catalogue, this machine: `serve.ready` −188 ms, 6 of 6 pairs faster,
  in one session, and −143 ms, 5 of 6 blocks faster, in another.
- `examples/basic`, 10 pairs: `serve.ready` +74 ms with a median of +12 ms,
  the first edit +52 ms, the restore +8 ms, and the fork +12 ms.
- In one basic pair, `prepareContext` arrived before the load started. Its
  path lookups then waited for the load, and the child forked at 203 ms
  instead of 110 ms.
- The return-pass sidecar answered `hello` 63 to 94 ms after the edit write,
  against 106 to 201 ms on `main`. So the pool sent the edit's `bundle`
  request to it in 9 of 9 runs, against 4 of 10 on `main`, and its load ran
  beside the edit.
- Official check, mokly-cloud, 6 warm pairs: `serve.ready` 1,105 to 978 ms,
  −126 ms with 5 of 6 faster, a median of −72 ms, and −48 ms without its
  first pair. First Changes −167 ms. Edits after the restart 2.19, 1.68,
  and 1.72 s against 2.20, 1.67, and 1.64 s. Cold whole-tree peak 3,118 to
  3,128 MiB, +0.3%, over 4 pairs. It passed the C0 rule.

## Prototype 3: core-only read beside the spawn

The pool read the bundle cache entry on a scoped thread while it started the
sidecar, and the seed used the result. Cloud catalogue, this machine:
`serve.ready` +68 ms, 3 of 6 pairs faster, with `hello` 36 ms later, in one
session, and −120 ms, 6 of 6 blocks faster, in another. It did not shorten
the first Changes. The orchestrator rejected it, because its sessions
disagree.

## Prototype E: early answer on request

The pool set a new `early` field of `hello` when a request without a PostCSS
preparation started the sidecar. A prepared `bundle` request and the return
pass left it unset. Without it, the entry read `hello`, loaded, and then
answered, as on `main`. With it, the entry answered at once and loaded
directly after the reply.

| Session          | Measure                            |    E − `main` | A/A control − `main` |
| ---------------- | ---------------------------------- | ------------: | -------------------: |
| Basic, 10 pairs  | `serve.ready`, first edit, restore | −43, +93, +72 |                 none |
| Basic, 10 blocks | `serve.ready`, first edit, restore | +24, −34, −44 |        +98, +77, +12 |
| Basic, 20 blocks | `serve.ready`, first edit, restore | +46, +24, +28 |        +91, +48, +35 |
| Cloud, 6 pairs   | `serve.ready`                      |           +12 |                 none |
| Cloud, 6 blocks  | `serve.ready`                      |          −141 |                 −148 |

- Pooled over the 40 basic pairs and blocks, E − `main` is +18 ms for
  `serve.ready`, +27 ms for the first edit, and +21 ms for the restore.
- Official check, mokly-cloud, 8 warm pairs: `serve.ready` 1,027 to 1,044 ms.
  The changes were +58, −47, +11, +204, −10, −21, −68, and +16 ms: a mean of
  +18 ms, a median of 0 ms, and 4 of 8 faster. The rule needed −80 ms on the
  mean, −60 ms on the median, and 6 of 8. First Changes −50 ms. Edits 1.87
  against 1.86 s. The orchestrator stopped the memory pairs before they
  started.
- In that check, the first `sidecar.spawn` span fell from 123 to 61 ms, but
  the first `catalogue.bundle` ended only 16 ms earlier.
- The C0 gain was mostly noise: in the C0 session, the first
  `catalogue.bundle` of `main` ended at 578 ms on average, against 502 ms in
  the E session, because one `main` start was slow.

## Arm effect on this machine

In both three-arm basic sessions, `main` ran faster than its own A/A control.
Over 30 blocks, the control was +93 ms on `serve.ready`, +58 ms on the first
edit, and +27 ms on the restore. On the cloud catalogue, the control was
−148 ms in one session. The cause is not known. A 30 ms bar is below this
spread, so a check on this machine needs many pairs or an A/A arm.

## Rejected assumption

The experiment assumed that an earlier `hello` shortens a warm start by most
of the session load: on basic through an earlier child, and on mokly-cloud
through an earlier bundle cache read. The prototypes and the two official
checks reject it. On basic, the load and the child start compete for the CPU,
and the stylesheet chain absorbs the rest. On mokly-cloud, the bundle work
after `hello` takes about as long as the load that it overlaps.

## Outcome

- On 2026-11-22, the orchestrator closed the experiment with option A. No
  product pull request of the light entry follows.
- `main` never held a prototype. The protocol docs and the product on `main`
  stay unchanged.
- The single-start-path fix from the review of #470 went into its own pull
  request instead of the light-entry pull request.
