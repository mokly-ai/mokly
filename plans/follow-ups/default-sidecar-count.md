# One sidecar per core adds memory, not speed

- **Severity:** Medium. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from decision 6 of the closed "Hash-Based Content
  Caching" workspace, 2026-10-27, which the user did not answer.
- **Location:** `docs/protocol/mokly-sidecar.md:17` and
  `crates/mokly-cli/src/options.rs:43`.
- **Reason:** The fix changes a documented default of the sidecar protocol,
  and the user has not chosen an option.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Sidecar:** the Node process under `packages/mokly/src/sidecar` that
    bundles, evaluates, and renders the JavaScript entries.
  - **Sidecar pool:** the set of sidecars of one command. Each sidecar
    loads the whole bundle: React, the renderer, and every entry module.
- **Background:**
  - `docs/protocol/mokly-sidecar.md:17` makes the machine's core count the
    default pool size. `--sidecars {n}` and `MOKLY_SIDECARS` override it.
  - Each sidecar holds its own copy of the bundle, about 220 MiB when idle
    on 2026-10-27.
  - On 2026-10-27, a development build of `examples/basic` on 8 CPUs gave
    these runs:
    - Build without Changes: 1 sidecar 61 s and 1.8 GiB, 2 sidecars 56 s
      and 2.2 GiB, 4 sidecars 56 s and 2.6 GiB, 8 sidecars 57 s and 3.1
      GiB.
    - Build with Changes: 2 sidecars 181 s and 2.2 GiB, 8 sidecars 182 s
      and 4.1 GiB.
  - On 2026-10-26 the large React fixture, with 2 sidecars, kept both
    sidecars busy in its parallel passes. So a large React catalogue can
    gain from more sidecars.
  - The performance work of 2026-10-27 to 2026-10-29 changed render times.
    Nobody measured the sidecar count after it.
- **Problem:** Machines with many cores start many sidecars. On the example
  catalogue the extra sidecars add memory and no speed.
- **Impact if no action:** A 12-core laptop starts 12 sidecars, about
  2.6 GiB of idle bundle copies.
- **Root question:** How many sidecars should a command start by default, so
  that renders stay fast and memory stays low?
- **Options:**
  - **A.** Change nothing, and document `--sidecars` in the guides. Effort:
    Small.
  - **B.** Cap the default, for example at 4. Choose the cap from a new
    benchmark of `examples/basic` and the large React fixture. Users can
    still raise it with `--sidecars`. Effort: Small (estimate).
  - **C.** Start one sidecar, and add more only while requests wait, up to
    the core count. Stop idle sidecars. This changes the pool and needs new
    tests. Effort: Large (estimate).
- **Left out:** A single sidecar for every catalogue. Large React
  catalogues use more than one at full load.
- **Wider fix:** C. The pool then sizes itself to each catalogue.
- **Previous examples:** PR #225 bounds Serve's background pass by the
  smaller of the worker count and the sidecar count.
- **Related:**
  - [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md): the
    other large part of sidecar memory.
  - [serve-sidecar-prestart.md](./serve-sidecar-prestart.md): it changes
    when sidecars start.
- **Recommendation:** B. It removes most of the idle memory with a small
  change, and C can follow when large catalogues need it.
- **Action:** ask the user, because option B changes the default pool size
  that `docs/protocol/mokly-sidecar.md` states.
