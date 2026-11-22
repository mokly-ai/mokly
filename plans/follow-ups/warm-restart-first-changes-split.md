# First Changes after a warm restart waits for the base

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-first-changes-after-restart-ee55`, the split that the
  performance orchestrator requested, and its closed experiments B1 and B2.
- **Location:**
  - `crates/mokly-cli/src/serve_eager_task.rs:110` to line 139: the eager base
    thread waits for the adopted head before it selects the base dependencies.
  - `crates/mokly-cli/src/changes_base.rs:117` to line 143: the base dependency
    selection, which reads the dependency directories that the head recorded.
  - `crates/mokly-cli/src/serve_eager_native.rs:218` (`adopt`) and
    `crates/mokly-cli/src/serve_eager_adoption.rs:29` (`take_prepared`): the
    adoption of the eager preparation by the classification.
  - `crates/mokly-compare/src/base_classification.rs:101` to line 160: the base
    capture, which ends before the comparison starts.
  - `crates/mokly-compare/src/comparison.rs:62` to line 105: the head
    validation, then the move pairing and the view stream.
  - `docs/protocol/mokly-eager-base-preparation.md`, section Start, and
    `docs/protocol/mokly-comparison-serving.md`, section View Comparison Reuse.
- **Reason:** The two options that reach the goal each change a requirement or
  a decision in force, and on 2026-11-22 the performance orchestrator asked the
  user to choose between N, D, and neither.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Warm unchanged restart:** a Serve start whose render store holds every
    document of the head and of the base, with no source change since the last
    session.
  - **Base chain:** the eager base work after Serve adopts the head preparation:
    the base dependency selection, the base bundle cache hit with its own
    sidecar start, restore, and `describe`, the base catalogue validation, the
    base render keys, and the base graph.
  - **Adoption:** the start of the classification. It waits for the eager base
    work and checks again that its inputs are current.
  - **Head dependency evidence:** the dependency directories that the head
    preparation used. They select the base dependencies.
  - **Kept comparisons:** the view comparisons of the last accepted
    classification, which Serve keeps in memory for proven reuse on later edits.
- **Background:**
  - The request of 2026-11-22: after a warm unchanged restart of `mokly serve`
    on `mokly-cloud`, publish the first ready Changes at least 300 ms sooner,
    with every published byte, warning, and diagnostic unchanged, no slower warm
    edit, and a whole-tree memory peak within 2% of `main`. The stop bar: no set
    of safe changes that projects 150 ms.
  - After readiness, Serve runs the background pass, which reads the 1,508 views
    of `mokly-cloud` from the render store, then classifies Changes. The eager
    base preparation prepares the base beside the pass, and the classification
    adopts it.
  - The base chain starts only when Serve adopts the head preparation, close to
    readiness. Its dependency selection needs the head dependency evidence.
  - So on a warm restart the classification waits for a base chain that repeats
    the work of the last session, then captures the base, validates the head,
    and compares every view again.
  - On warm edits the classification takes about 140 ms, because it reuses the
    proven facts, the walk records, and the kept comparisons that exist only in
    memory.
  - The section "Measurements of 2026-11-22" below gives the split and its
    method. The section "Closed: B1 and B2" gives the two experiments that the
    performance orchestrator rejected, with its official check.
- **Problem:** On a warm restart, the first ready Changes waits about 400 ms
  for a base chain that starts at readiness and repeats the last session, then
  about 480 ms for a full base capture and a full comparison.
- **Impact if no action:** Each warm restart of `mokly-cloud` keeps about
  1.56 s from readiness to ready Changes without timing records, and about
  2.1 s in timed runs.
- **Root question:** How can a warm restart show ready Changes 300 ms sooner
  from the Serve start, with equal output and readiness, and every reused input
  checked again?
- **Options:** The letters are those of the decision of 2026-11-22. B is closed
  and J is left out, as **Left out** says.
  - **A.** Change nothing, and keep this record as a closed experiment.
    Effort: Small.
  - **C.** Start the base capture as soon as the base graph exists, beside the
    adoption checks. A failed check cancels and discards the capture, and the
    classification prepares the base as today. About 65 to 75 ms. It changes
    the rule that the classification starts comparison work only when it adopts
    the preparation. Effort: Medium.
  - **D.** Keep the kept comparisons across restarts in a new cache kind, with
    the build identity of the render store in the reuse fence. The next
    classification checks every recorded read again by content identity, as
    warm edits do. About 200 ms without timing records. Memory: a transient
    decode of about 8 to 20 MB. It changes the decision "only Serve keeps view
    comparisons, in memory" of `docs/protocol/mokly-comparison-serving.md`.
    Effort: Large.
  - **E.** Keep the base capture across restarts, with a new check of the
    closure resources of each kept view. About 150 ms without timing records.
    It changes two capture rules of the same page. Effort: Large.
  - **F.** Start the base dependency work when the head bundle ends, about
    440 ms after the Serve start, with the evidence of that time. The adoption
    compares it with the final evidence. About 300 ms, but only when the
    evidence is final at the bundle end, which nobody measured. It reverses the
    recorded rejection of a start at the head bundle end. Effort: Large.
  - **G.** Record the head dependency evidence of each accepted classification
    in the cache. At the next start, take the record when the eager source
    phase ends, about 121 ms after the Serve start, and run the dependency
    selection, the validation, the render keys, and the graph without a wait for
    the head. No installation and no freshness inputs before the adopted head.
    The adoption compares the record with the final evidence, and a mismatch
    discards that work and starts it again. About 320 ms before any readiness
    delay; then the pass end limits it. Risks: base work beside the head
    startup, eager core work on the shared render threads, and stylesheets that
    the base may compile before the head. Effort: Large.
  - **H.** G and C. About 360 ms. Two protocol decisions. Effort: Large.
  - **I.** G, and the base capture during the pass. About 400 to 450 ms. It also
    changes the decision that the base capture waits for the pass, because head
    and base memory then add up. Effort: Large.
  - **K.** Compare each view as soon as the base capture has taken its base
    view, instead of after the whole capture. Up to about 150 ms. No protocol
    rule forbids it. A later base validation failure must discard every
    comparison. Risk: medium to high. Effort: Large.
  - **L.** Read each adoption input once. It is on the branch, and the section
    "L on the branch" gives its measured effect, about 25 ms. Effort: Small.
  - **M.** Start one base sidecar process when the eager source phase ends.
    About 169 ms today, and none under G. It adds a process start during
    startup, in the base start path of the pool and the sidecar. Effort: Large.
  - **N.** G and L. About 345 ms before any readiness delay. One protocol
    decision. The decision of 2026-11-22 proposed G, B, and L; B is closed.
    Effort: Large.
  - **O.** Keep the content identity of a document after its first
    computation, because the capture and the comparison compute it twice for a
    shared document. Not measured. Effort: Medium.
  - **P.** A faster codec for the compact tier of the render cache, the capture,
    and the render store. A new dependency and a new store format version. Not
    measured. Effort: Large.
- **Left out:**
  - B1 and B2, closed on 2026-11-22. The section "Closed: B1 and B2" gives
    their measurements and the reasons.
  - J, a stored accepted Changes result that Serve publishes after the pass when
    every input is equal. A later process cannot check every input: the
    freshness checks miss known changes, as `docs/protocol/mokly-base-preparation.md`
    says, and `docs/protocol/mokly-render-store.md` rejects a stored Serve
    state with Changes.
  - A larger capture window. It breaks the window decision of
    `docs/protocol/mokly-comparison-serving.md`, and the cores are not the
    limit.
  - A reuse of the head bundle or the head `describe` for an equal base. It
    helps only `--base HEAD` on a clean tree, not a real branch.
  - Fewer timing records. Serve is not faster, as the section "Timing records
    and noise" says.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #466 and PR #472 reuse proven facts on warm edits.
  PR #470 starts the base PostCSS child earlier.
- **Related:**
  - [cold-start-base-overlap-memory.md](./cold-start-base-overlap-memory.md):
    more startup overlap than the accepted Ready-only bounds of the eager base
    preparation is a new user decision. G, and so N, H, and I, add such
    overlap.
  - [eager-base-competes-with-head-usage.md](./eager-base-competes-with-head-usage.md):
    an earlier start of cold base discovery at the head bundle end made cold
    readiness 171 ms later on the mean, and about 350 ms later in 3 of 4 runs.
    The owner kept the Ready-only policy for readiness safety.
  - [early-base-capture-evicted-results.md](./early-base-capture-evicted-results.md):
    the eviction of early base results from the full tier of the render cache.
    B1 below lost time to a similar eviction of head documents.
  - [closed-experiment-record-kind.md](./closed-experiment-record-kind.md): the
    open decision on records that ask for no action. Option A of this record
    applies its answer.
  - [serve-edit-background-pass-split.md](./serve-edit-background-pass-split.md):
    the split of the warm edits, whose cuts this restart split does not repeat.
- **Recommendation:** N. It is the only set that projects 300 ms or more from
  the Serve start with one protocol decision, and it keeps no result across
  processes, because the existing adoption comparison keeps every output equal.
  Accept it only when `serve.ready` is not later beyond the noise of an A/A run
  and the memory peaks stay within 2%. Without startup overlap, D with L
  projects about 225 ms, at a larger change with persistent state.
- **Action:** ask the user, because N changes the Start rule of
  `docs/protocol/mokly-eager-base-preparation.md` and adds a cache record, more
  startup overlap than the Ready-only bounds is a user decision by
  `cold-start-base-overlap-memory.md`, and D reverses a recorded decision with
  persistent state beyond one Serve process.

## Measurements of 2026-11-22

The probes, the drivers, and the analysis scripts ran only on the local
machine, outside the repository. They are not official timings; the
performance orchestrator owns those.

### Method

- The catalogue is the `mokly-ai/mokly-cloud` repository at `194fdb78`, with
  its own `mokly.config.json`, `npm ci` in `ts/`, and the release core and the
  dist of each arm installed over its `@mokly` packages, with the published
  0.21.0 viewer, model, frame, and ui dists. Serve used `--base HEAD` unless a
  line names `--base ae0b57b5`, and the default 4 sidecars.
- The machine is a 4 vCPU KVM host with 7.9 GB of memory and Node 24.22.1.
  Each arm had its own clone and its own cache directory. A warm restart is a
  session whose render store served all 1,508 documents of the head, and of the
  base when the base differs.
- Each Serve session ran in its own transient systemd scope with
  `MemoryMax=6G` and `MemorySwapMax=0`. A driver sampled the scope every 50 ms.
- A probe, never committed, added phase spans on the core clock. Its second
  form also dropped the per-view timing records and the per-lookup render store
  records, so that about 270 records remain.
- The official clock of the performance orchestrator, from 2026-11-22: untimed
  Serve, a driver clock from the spawn to the first event-stream revision whose
  index has `changesStatus: "ready"`, the listening line as a readiness guard,
  and at least 8 interleaved pairs.

### Split of a warm unchanged restart

Means of 6 restarts with phase records only, in ms from the Serve start:

| Part                                                       | Start |   End | Duration |
| ---------------------------------------------------------- | ----: | ----: | -------: |
| `serve.ready`                                              |       |   889 |          |
| Eager base source phase                                    |       |   121 |          |
| Head bundle                                                |       |   440 |          |
| Background pass, 1,508 render store reads                  |   889 | 1,493 |      604 |
| Base chain, from the adopted head                          |   870 | 1,816 |      946 |
| - Base bundle cache hit, with a sidecar start of 169 ms    |   870 | 1,505 |      631 |
| - Rest of the base validation, mostly the base `describe`  | 1,505 | 1,672 |      167 |
| - Base render keys                                         | 1,674 | 1,775 |      101 |
| - Base graph                                               | 1,777 | 1,816 |       39 |
| Classification                                             | 1,498 | 2,448 |      950 |
| - Adoption: check before the wait                          | 1,501 | 1,533 |       32 |
| - Adoption: wait for the base chain                        | 1,533 | 1,817 |      284 |
| - Adoption: `take_prepared` checks                         | 1,817 | 1,870 |       53 |
| - Adoption: replay of kept status events, and the provider | 1,870 | 1,892 |       22 |
| - Base capture, 2.82 busy cores                            | 1,892 | 2,089 |      197 |
| - Head validation                                          | 2,089 | 2,123 |       34 |
| - View stream, 2.36 busy cores                             | 2,124 | 2,360 |      236 |
| - Identity, metadata files, and the Git reference check    | 2,371 | 2,379 |        8 |
| - Ready publication                                        | 2,379 | 2,448 |       69 |

- During the head startup only 1.78 of 4 cores are busy.
- The anonymous memory is about 400 MiB at readiness, 800 MiB at the pass end,
  and 1,010 MiB at ready Changes. It peaks at about 1,120 MiB 1.3 to 1.8 s
  after ready Changes. So moving base work earlier changes when memory is used
  more than how much.
- Work that repeats the last session with the same inputs: the base sidecar
  start, restore, and `describe`; the base validation, render keys, and graph;
  the reads of the working dependency inputs and the checkout identity during
  the adoption; the base capture with 1,508 lookups, closure walks, zlib
  encodes, and SHA-256 identities; 659 head closure walks; and all 1,508 view
  comparisons.
- With `--base HEAD`, base and head documents share their keys, so the base
  capture hits the render cache that the pass filled.

### Split on a real base

Means of 6 restarts of `main` with `--base ae0b57b5`, phase records only, in
ms after `serve.ready`: pass end 535; classification start 539; adoption check
29, wait 273, `take_prepared` 53; base capture 424; head validation 56; move
pairing 107; view stream 644; publication 76; ready Changes at 2,307.

### Timing records and noise

- `--debug-timings` writes about 37,000 JSON lines, 10.7 MB, for each warm
  restart, mostly per-view spans, each under the stderr lock. An off-CPU
  profile found 344 of 511 sleeps of the base capture jobs on that lock.
- On `main`, the gap from the listening line to ready Changes was 1,967 ms
  timed and 1,593 ms untimed on one clock. Timed readiness was about 130 ms
  later.
- An A/A run of `main` against `main` gave pair differences with a standard
  deviation of 234 ms untimed and 580 ms timed, over 8 pairs each. The host
  drifted by up to 600 ms within an hour.

## L on the branch

- L1: when the eager base task has already ended, the adoption skips its check
  before the wait, because `take_prepared` repeats it. On `mokly-cloud` the
  eager work still runs when the classification starts, so L1 saves nothing
  there.
- L2: the adoption evidence check returns the checkout identity and the working
  dependency inputs that it read, and `take_prepared` gives them to the
  freshness check, so each is read once. In each of 6 real-base sessions of
  the split, `take_prepared` fell from 48 to 56 ms on `main` to 26 to 29 ms,
  and its freshness part from 27 ms to 2 ms.
- So L saves about 25 ms on both bases.
- Review round 1 found that L2 took the checkout sample before the working
  input scan, so a change of the checkout settings during that scan passed.
  Its finding check removed the finding: `main` reads the identity, then the
  working inputs, twice, so a change during its second working read passes
  too, and the unchecked window has the same length. Serve watches no Git
  settings, and the next classification reads the identity again in both
  versions.
- On 2026-11-22 the performance orchestrator directed the reorder anyway, as a
  hardening: commit `18ad88623` reads the working inputs first, then the
  checkout identity, with the test
  `adoption_rejects_a_checkout_change_during_the_working_input_scan`. The
  window for the unwatched checkout settings shrinks to the install reads. The
  window for the working inputs grows by one identity read, which runs three
  Git commands.
- Untimed on the official clock, 8 interleaved pairs on each base, L alone
  against `main` measured −154 ms with `--base HEAD` (standard deviation of the
  pair differences 351 ms) and −121 ms with `--base ae0b57b5` (306 ms). The
  listening line moved −3 ms and −113 ms. L cannot change readiness, so most of
  these means is noise.
- On 2026-11-22 the performance orchestrator stopped L as its own pull request,
  because its effect of about 25 ms is below a 30 ms bar that 8 pairs cannot
  resolve. L joins the pull request of the option that the user chooses: N or
  D. If the user chooses neither, the orchestrator decides between a small L
  pull request with a mechanism check and a docs-only record.

## Closed: B1 and B2

Both were option B of the decision of 2026-11-22, together with L, and the
first pull request candidate, commit `4e9f6fadc`.

- B1 ran the head validation of the first classification on a scoped thread
  beside the base preparation, when the first lookup found no kept base. The
  comparison took the prepared result only for the same pinned request, reuse
  fence, head generation, and accepted classification.
- B2 let the reference index of the closure walk keep its first edges in an
  `Arc`, and parse and copy outside its mutex, because 120 of 152 sleeps of the
  base capture jobs waited for that mutex.

The official check of the performance orchestrator, on 2026-11-22: untimed
Serve on the official clock; the core of `main` `a2ae56360` against
`4e9f6fadc`, built the same way; the dist of `a2ae56360` in both arms; 8
interleaved warm unchanged restart pairs for each base.

| Measure                                   | `main`    | `4e9f6fadc` | Rule     | Result |
| ----------------------------------------- | --------- | ----------- | -------- | ------ |
| `--base HEAD`, listening line             | 1,068 ms  | 1,080 ms    | ≤ +30 ms | pass   |
| `--base HEAD`, first Changes              | 3,028 ms  | 2,990 ms    | ≤ −60 ms | fail   |
| `--base ae0b57b5`, listening line         | 1,068 ms  | 1,076 ms    | ≤ +30 ms | pass   |
| `--base ae0b57b5`, first Changes          | 4,729 ms  | 4,804 ms    | ≤ +30 ms | fail   |
| Cold 10-edit sessions, 4 pairs, tree peak | 3,132 MiB | 3,137 MiB   | ≤ +2%    | pass   |

- With `--base HEAD` the difference was −38 ms, with a median of −44 ms, and 5
  of 8 pairs were faster.
- With `--base ae0b57b5` it was +75 ms, with a median of +110 ms, and 3 of 8
  pairs were faster. The pairs were +293, −136, +185, +144, −157, +247, −52,
  and +76 ms.

The split that followed, on the real base, 6 sessions of each arm in 3
interleaved rounds, phase records only, in ms after `serve.ready`:

| Part                             | `main` | `4e9f6fadc` |
| -------------------------------- | -----: | ----------: |
| Pass end                         |    535 |         527 |
| Adoption check before the wait   |     29 |          43 |
| Adoption wait for the base chain |    273 |         291 |
| `take_prepared`                  |     53 |          27 |
| End of the base graph            |    844 |         867 |
| Head validation, at              |  1,348 |         536 |
| Head validation, duration        |     56 |          54 |
| Base capture                     |    424 |         428 |
| Move pairing                     |    107 |         123 |
| View stream                      |    644 |         747 |
| Publication                      |     76 |          73 |
| Ready Changes                    |  2,307 |       2,361 |

- The comparison took the prepared head result in 6 of 6 sessions, so the take
  condition held.
- The early head validation ran on the same four render threads as the base
  render keys and the base graph of the eager chain. The tree used 3.0 cores in
  that window, and the base chain ended about 23 ms later.
- The view stream was slower in every session: 701 to 794 ms against 609 to
  697 ms. The render cache counts of the comparison gave 2,811 compact restores
  against 2,755. On `main` the head validation runs right before the view
  stream. With B1 the base capture of 1,508 different base documents runs in
  between and evicts head documents.
- With `--base HEAD`, base and head share their documents, so nothing is
  evicted, and only the head validation moves off the path.
- Review round 1 also found that B2 can hide the parse error of one caller when
  another caller stores the edges of other bytes first, and that the early head
  validation ignored the cancellation of its classification.
- The part of B2 in the view stream loss was not isolated, because the
  performance orchestrator stopped the measurement once B was closed.
- On 2026-11-22 the performance orchestrator dropped B1 and B2: B1 loses on a
  real base, which is the normal case, and B2 has a High review finding and no
  shown gain.

## Proposed protocol text for G

This text is a proposal from 2026-11-22, not a requirement in force. A branch
that builds G moves it into `docs/protocol/mokly-eager-base-preparation.md`
after the user's answer.

- Start, in place of the paragraph on the head dependency evidence: "Head
  dependency evidence is the set of dependency directories that the head
  preparation used. The package tiers select the base dependencies with it.
  Dependency selection, installation, the validation of the base catalogue, the
  base graph, and the freshness record wait until Serve adopts the head
  preparation of the state, after any watch recheck. A recorded evidence can
  start all of them except the installation and the freshness record earlier."
- In place of the decision on dependency work: "Decision: dependency work waits
  for the adopted head preparation, or starts from a recorded evidence that the
  adoption then compares. Rejected: a start when the head bundle ends, because
  the description, the class maps, and the stylesheets of the head record more
  dependency directories after it, so a partial list can change a tier, a
  warning, or an install. Rejected: a wait for the adopted head at every start,
  because the base work then delays the first Changes of each restart by its
  whole length."
- A new section, Recorded Head Evidence: "Serve records the head dependency
  evidence of each accepted classification in the Mokly cache of the
  repository, for its working configuration and the build of the native core.
  A later record of the same configuration and build replaces it. The record
  holds directory names only: no result, no source bytes, and no environment
  value. When eager preparation of a head attempt finds a record for its
  working configuration and build, it takes the recorded evidence once its
  source work ends. It then selects the base dependencies, validates the base
  catalogue, and prepares the base graph without a wait for the head. It starts
  no installation and records no freshness inputs before Serve adopts the head
  preparation. A selection that needs an installation waits for that adoption.
  When Serve adopts the head preparation, eager preparation compares the
  recorded evidence with the head dependency evidence. When they are equal, the
  work continues as if it had started at the adoption. When they differ, it
  discards the work that used the record, and it starts that work again with
  the head dependency evidence. So the record changes when the work runs, never
  its result. Serve readiness never waits for work that a record starts. A
  missing, damaged, foreign, or unreadable record is a normal event: Serve
  prints nothing and waits for the adopted head. A failed write is a normal
  event too. Deleting the cache changes time only. Decision: one small record
  for each configuration and build. Rejected: no record, because the base work
  then starts only at readiness. Rejected: a key without the build, because
  another build can record other directories, so its starts would be
  discarded."
- `docs/protocol/mokly-base-cache.md`: the record joins the kinds of the cache
  namespace, as one small file for each configuration and build, with the
  format and digest rules of a bundle entry, inside the bundle kind bound.

## Decisions

- 2026-11-22, the performance orchestrator: the official clock for first
  Changes is untimed Serve on the driver clock from the spawn to the first
  ready event, with the listening line as a readiness guard and at least 8
  interleaved pairs, and with a real base for any option that changes the
  capture or the comparison. Timed runs serve splits only.
- 2026-11-22, the performance orchestrator: B and L as the first pull request,
  with a goal of 60 ms. N and D wait for the user.
- 2026-11-22, the performance orchestrator, after its official check and the
  split: B1 and B2 are dropped, and the finding on the checkout sample of L2 is
  fixed in any version that keeps L.
- 2026-11-22, the performance orchestrator: L stops as its own pull request
  and joins the option that the user chooses. Product work stops until the
  user's answer on N, D, or neither.
