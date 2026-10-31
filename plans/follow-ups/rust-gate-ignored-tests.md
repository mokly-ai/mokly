# Rust test step has no skip rejection

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from the test skills review baseline on branch `calummoore/test-skills-guidelines-review`, design item G1.
- **Location:** `docs/protocol/ci-verification.md:75-76`, `xtask/README.md:79`, and `xtask/src/check/commands.rs:28` and `:61`.
- **Reason:** The audit records the mismatch and preserves current verification. A later branch applies the user's policy choice.

- **Source:** Design.
- **Category:** Docs or spec.
- **Terms:**
  - **Suite:** one part of `cargo xtask check`, the complete gate, which hosted CI and remote Testboxes also run.
  - **Strict runners:** the Node and Playwright runners of the gate, which validate a report and fail on any skipped test.
  - **`#[ignore]`:** a Rust test attribute that makes `cargo test` list the test as ignored and skip it, unless the run passes `--ignored` or `--include-ignored`.
  - **`--include-ignored`:** a stable Rust test-runner flag that runs the ignored tests together with all other tests.
  - **Child-process entry point:** an ignored test function that a parent test starts in a new copy of the test binary.
- **Background:**
  - The Repository and Native suites run `cargo test --workspace`. `xtask` checks only its exit status, at `xtask/src/command.rs:66-88`.
  - Cargo counts ignored tests in its summary and still exits 0. No suite reads that count.
  - The strict runners fail on any skipped Node or browser test. The static delivery check is a gate step after the browser suite, and it also fails on a skipped test.
  - Today the only ignored Rust tests are two `depth_probe_child` entry points. They are in the CSS and catalogue `nesting_depth_tests.rs` files.
  - Each parent depth test starts an entry point with `--exact --ignored`. It fails unless the child reports `1 passed`, at `crates/mokly-css/tests/depth_search/mod.rs:94-119`. So the gate leaves out no Rust check today.
- **Problem:** Both docs say that every suite rejects skips and todos. The Rust test steps do not reject ignored counts. A passing Rust step can report the two ignored entry points.
- **Impact if no action:** The spec keeps a guarantee that the gate does not give. A reader or a reviewer then expects the gate to stop a later ignored Rust test, but the gate does not stop it.
- **Root question:** Which skip guarantee should the gate give for Rust tests, so that the docs promise only what the gate enforces?
- **Options:**
  - **A.** Change nothing. The docs keep a promise that no Rust check enforces. Effort: Small.
  - **B.** Narrow the wording in both docs. Skip rejection covers the Node, browser, and delivery reports. Allow `#[ignore]` only for a child-process entry point that a parent test runs and checks. No code changes. Only review then enforces the `#[ignore]` rule, so a later ignored Rust test can pass the gate. Effort: Small.
  - **C.** Move the child entry points to a mechanism without `#[ignore]`. Then add a check that fails when `cargo test` reports an ignored test. The check needs a new way to read Cargo output, because `xtask` reads only the exit status. It also forbids `#[ignore]` for local skips. It adds a gate check, so it needs the user. Effort: Medium (estimate).
  - **D.** Run ignored Rust tests in the gate. Add `--include-ignored` to the two Rust test commands. In each depth file, let one parent test run itself again as the child, so that no entry point passes without checks. Change the gate and developer docs: the gate runs every Rust test, and a developer `cargo test` still skips ignored tests. It is stricter validation, so it needs the user. A later slow or resource-bound ignored test then runs in every gate. Doc examples marked `ignore` also run. Effort: Small.
- **Left out:**
  - Removing the depth searches fails the goal, because the docs still promise a rejection that the Rust steps do not have. The test value review must assess these searches separately.
  - An entry point that runs as a normal test and returns early without its variable passes without checks in the default run. The `testing` skill forbids that.
  - Rust report evidence through a new runner, such as cargo-nextest, adds a tool to get the same rejection that C gives. The JSON report of the built-in Rust test runner needs a nightly-only flag.
- **Wider fix:** D. It is a structural default: the gate runs every ignored Rust test, whatever form the marker has. C only detects the same tests, so it ranks below D.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/locked-cargo-gate.md`, which touches the same code. It changes the same Cargo commands in `xtask/src/check/commands.rs`, and its stricter options also wait for the user.
- **Recommendation:** B. It makes the documented guarantee match current execution. Current probe checks still run through their parents. Its cost is a narrower gate guarantee. D gives the best protection to the codebase, but it adds stricter validation for a marker that does not exist today.
- **Action:** ask the user, because condition 1 holds: B changes the wording of a requirement in force, and no recorded user decision covers Rust skips.

The options check added D and changed C from Large to Medium. It kept B as
the recommendation and chose D as the wider fix. No option has user approval.
The choice blocks later changes to the Rust skip contract, the gate commands,
and the two probe entry points. It does not block the baseline, measurements,
or the rest of the test audit.

The two probe entry points are in
`crates/mokly-css/tests/nesting_depth_tests.rs` and
`crates/mokly-catalogue/tests/nesting_depth_tests.rs`. The shared launcher is
`crates/mokly-css/tests/depth_search/mod.rs`. Each child receives
`MOKLY_DEPTH_PROBE` with its probe name and depth. Stack overflow stops a
process, so each depth needs its own child.

Related source observation for the later test review: `run_child` returns
immediately when `MOKLY_DEPTH_PROBE` is absent. A manual ignored-only run can
therefore report an entry point as passed without checks. The active parent
path supplies that variable and checks the child result. The baseline did
not execute an ignored-only run. Assess this source observation with the
probe tests before implementing an option that retains or includes them.

Rust documents the ignored test flags in the
[libtest selection options](https://doc.rust-lang.org/rustc/tests/index.html#selection-options).
Cargo forwards test-runner flags after `--`, as the
[Cargo test command](https://doc.rust-lang.org/cargo/commands/cargo-test.html#description)
defines. Option D must pass `--include-ignored` after that separator.
