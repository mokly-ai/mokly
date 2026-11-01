# Derived select controls repeat option values

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: the options check of the plan for the viewer's leftover layers.
- **Location:** `crates/mokly-model/src/controls.rs:80-100`, `packages/viewer/src/components/controls.ts:104`, and `docs/protocol/mokly-component-controls.md:48-49`.
- **Reason:** On 2026-11-01 the user chose to change nothing about the schema differences until the viewer runs the Rust checks, and this option came after that answer.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Derived control:** a Props field that the core makes from a prop's
    schema when the author declares no control, in
    `crates/mokly-model/src/controls.rs`.
- **Background:**
  - The core makes a select control from a prop's `enum` values or its
    `oneOf` constants, in `crates/mokly-model/src/controls.rs:80-100`.
  - `docs/protocol/mokly-component-controls.md:48-49` says that select
    options have unique values that the schema accepts.
  - Declared controls already reject repeated values, in
    `crates/mokly-catalogue/src/declared_controls.rs:163-188`. Derived
    controls have no such check.
  - The viewer checks every control of the index and rejects repeated option
    values, in `packages/viewer/src/components/controls.ts:104`.
  - JSON Schema 2020-12 allows repeated `enum` values, so the core's schema
    check accepts them.
- **Problem:** A schema with a repeated `enum` or `oneOf` value gives a
  derived select control with repeated options. The build succeeds, and the
  viewer then rejects the whole index.
- **Impact if no action:** One repeated value makes the catalogue unreadable
  in every viewer, with no error at build time.
- **Root question:** How do derived select controls offer each value once, as
  the controls contract requires?
- **Options:** The letters follow the options of the investigation of
  2026-11-01.
  - **A.** The core rejects a repeated `enum` or `oneOf` value with a
    diagnostic that names the source file. This is a new build error.
    Effort: Small.
  - **C.** Change nothing. The decision of 2026-11-01 keeps this state until
    the viewer runs the Rust checks. Those checks do not cover control
    options, so the problem stays then too. Effort: Small.
  - **D.** The core derives each option once. It keeps the first of repeated
    `enum` values, and it leaves out a repeated `oneOf` constant, because a
    value that matches two members fails `oneOf`. No build error and no
    requirement change. Effort: Small.
- **Left out:** Option B of the investigation, the viewer accepts repeated
  options: it breaks the unique values rule of the controls contract.
- **Wider fix:** D, because the derivation then cannot make the wrong case.
- **Previous examples:** `plans/follow-ups/saved-slot-reserved-metadata.md`
  records another check that differs between two places.
- **Related:** `plans/follow-ups/viewer-checks-from-rust.md`: the Rust index
  reader checks no control options, so that change does not fix this one.
- **Recommendation:** D. It meets the existing contract with no new error.
- **Action:** ask the user, because the user chose on 2026-11-01 to change
  nothing about the schema differences, and only the user can reopen that
  answer.
