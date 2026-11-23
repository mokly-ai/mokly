# esbuild keeps its memory after each bundle

- **Severity:** Medium. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from decision 7 of the closed "Hash-Based Content
  Caching" workspace, 2026-10-27, which the user did not answer. Measured
  again on 2026-11-22, on `main` at `1a2534d03`, by the kept-context change
  on branch `calummoore/mokly-edit-esbuild-context-3amj`.
- **Location:** `packages/mokly/src/sidecar/session.ts:1`,
  `packages/mokly/src/sidecar/kept-context.ts`, and
  `docs/protocol/mokly-sidecar-memory.md:4`.
- **Reason:** The measurement of 2026-11-22 shows that a `stop()` after every
  bundle costs each later compile a cold service, and that it would end the
  kept context of the edit process. Only the startup peaks hold idle services
  that no edit needs, so the fix narrows to the base process.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Sidecar:** the Node process under `packages/mokly/src/sidecar` that
    bundles, evaluates, and renders the JavaScript entries.
  - **esbuild service:** the Go process that the esbuild JavaScript API
    starts on the first build. It runs until `stop()` or until the Node
    process exits.
  - **Kept context:** the esbuild build context that each sidecar process
    keeps for its guarded edit compiles, under
    `docs/protocol/mokly-sidecar-kept-context.md`. It lives in the esbuild
    service of its process, so `stop()` ends it.
  - **Base process:** a sidecar process in the base root, which renders the
    base commit of Changes. It never compiles a head edit, and the return
    pass replaces it after each Changes publication.
- **Background:**
  - `session.ts:1` imports `build` from esbuild. No sidecar code calls
    esbuild's `stop()`, so the service lives as long as its sidecar.
  - `docs/protocol/mokly-sidecar-memory.md:4` sets a 1 GiB limit across one
    sidecar and its Node descendants. Native helpers such as esbuild are
    left out, so the recycle check does not see esbuild.
  - On 2026-10-27, a development build on `examples/basic` measured one
    bundle at about 6 s. esbuild peaked at 0.85 to 1.05 GiB.
  - On 2026-11-22, with a release core on 4 vCPU, the services at the
    whole-tree peak (cgroup `anon` plus `swap`) were:

    | Session on `main`                | Peak      | When          | esbuild at the peak                        |
    | -------------------------------- | --------- | ------------- | ------------------------------------------ |
    | mokly-cloud, cold, 10 edits      | 3,179 MiB | after edit 10 | the edit process, 358 MiB (11.3%)          |
    | mokly-cloud, cold, no edits      | 2,731 MiB | startup       | head 332 and base 324 MiB, both idle (24%) |
    | mokly-cloud, warm, 3 edits       | 2,525 MiB | during edits  | the edit process, 387 MiB (15.3%)          |
    | mokly-cloud, warm, no edits      | 1,462 MiB | startup       | none, no compile                           |
    | examples/basic, cold, 2 sidecars | 1,928 MiB | startup       | head 212 and base 273 MiB (25%)            |
    | examples/basic, cold, 4 sidecars | 2,334 MiB | after edits   | the edit process, 231 MiB (9.9%)           |

  - A process's startup service ends with its process: on cold mokly-cloud,
    base work replaced the startup head process at 17.4 s, and the return
    pass replaced the base process at 19.2 s, before the first Changes.
  - A `stop()` after every bundle, in 4 pairs of cold 10-edit mokly-cloud
    sessions: peak 2,959 against 3,180 MiB (−220 MiB, −6.9%; every pair
    lower). A new service starts in a few milliseconds, but its first compile
    takes 91 to 134 ms longer (a cold Go heap and empty esbuild caches). Each
    cold edit took 60 ms longer on the mean, and the mean of 3 warm edits
    28 ms longer.
  - A `stop()` only in a process without a kept context lowered the startup
    peak of cold mokly-cloud without edits from 2,716 to 2,132 MiB. On
    examples/basic with 2 sidecars the first edit runs on the startup head
    process, which then pays the cold service.
- **Problem:** Each sidecar that bundles keeps its esbuild service and its
  memory until the sidecar exits. At startup peaks, the idle services of the
  startup head process and of the base process hold about a quarter of the
  peak, and no edit needs the base one.
- **Impact if no action:** Startup peaks keep about 300 MiB for each idle
  base service: 324 of 2,731 MiB on cold mokly-cloud without edits, 273 of
  1,928 MiB on examples/basic with 2 sidecars.
- **Root question:** How does a sidecar give back the bundler's memory that no
  later compile of its process needs?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Call esbuild's `stop()` after each bundle request in every
    process. Measured: −6.9% at the cold 10-edit peak, but +60 ms on each
    cold edit, and it would end the kept context of the edit process.
    Effort: Small.
  - **C.** Count native helpers in the sidecar memory check, so that a large
    esbuild service triggers a recycle. This changes the sampling rule of
    the memory page, and a recycle costs more than a service start. Effort:
    Medium (estimate).
  - **D.** Call `stop()` after each bundle in a process that holds no kept
    context. Measured: lower startup peaks, no change at the cold 10-edit
    peak, and a cold service for a first edit on the startup head process,
    91 to 134 ms. Effort: Small.
  - **E.** Call `stop()` after the bundle of a base process only. It frees
    the base service at the startup peak, and no edit pays for it, because a
    base process never compiles a head edit. The sidecar does not know its
    root kind, so the pool must mark base bundles, for example with a
    request-only field. Unmeasured as such. Effort: Medium (estimate).
- **Left out:** Go runtime memory settings for esbuild. A 96 MiB
  `GOMEMLIMIT` cost each edit about 2.4 s, and `GOGC=50` for the kept
  context cost its first build 120 ms and removed its gain.
- **Wider fix:** None. B, D, and E differ only in which processes stop.
- **Previous examples:** None found.
- **Related:**
  - [eager-base-postcss-edit-peak-variance.md](./eager-base-postcss-edit-peak-variance.md): higher edit peaks at the same sampled process set. Both arms retain two esbuild services there, but the cause of the RSS difference is unknown.
  - [default-sidecar-count.md](./default-sidecar-count.md): the other large
    part of sidecar memory.
  - [serve-edit-bundle-split.md](./serve-edit-bundle-split.md): the record
    of the kept context, whose service B and D must keep.
  - The
    [compiled recipe cache item at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/compiled-recipe-cache.md)
    records an esbuild peak of 2.91 GB in a Mokly Cloud sample. It closed
    on 2026-11-01, when the sidecar pool started to keep the last released
    compiled recipe of each set of bundle settings.
  - [cold-start-base-overlap-memory.md](./cold-start-base-overlap-memory.md):
    its option D can test whether returning bundler memory removes added
    demand of early base work.
- **Recommendation:** E. It frees the largest idle service at the startup
  peaks and costs no edit. B and D cost edit time or end the kept context.
- **Action:** fix after merge, apply E, because no open branch owns the
  pool's base requests, and E needs its own measurement of the startup peaks.
