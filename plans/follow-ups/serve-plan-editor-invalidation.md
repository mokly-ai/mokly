# Editor files and new entries disable plan reuse

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-18, from the measurement of retained editor files and
  an added catalogue entry for the plan reuse change, on branch
  `calummoore/mokly-sidecar-plan-reuse-srh7` at commit `efb17e824`.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts:135` to
  line 143, `packages/mokly/src/sidecar/physical-inputs.ts:166` to line 191,
  `packages/mokly/src/sidecar/physical-input-reader.ts:131` to line 189,
  `crates/mokly-render/src/physical_inputs.rs:64` to line 96, and line 113,
  `crates/mokly-render/src/bundle_attempt.rs:61` to line 72,
  `crates/mokly-render/src/edit_plans.rs:32` to line 39,
  `crates/mokly-sidecar/src/methods.rs:60` to line 79,
  `docs/protocol/mokly-sidecar-recipes.md:72`, line 80, and line 96 to line
  97, and `docs/protocol/mokly-sidecar-plans.md:104` to line 108.
- **Reason:** On 2026-11-18 the performance orchestrator kept whole-record
  invalidation in the plan reuse change, and it required this item if
  retained swap files defeat every edit.

- **Terms:**
  - **Plan record:** the native import plan of one captured compile, paired
    with the reuse evidence of that compile.
    `docs/protocol/mokly-sidecar-plans.md` holds its rules.
  - **Native-first fallback:** an edit compile without a plan. It runs a
    native esbuild attempt and its classification, and a planned second
    attempt when the native result differs from Mokly's rules.
  - **Recorded directory:** a directory whose full entry list the reuse
    evidence keeps, because the resolver can look there for a candidate.
  - **Editor files:** files that an editor keeps beside a source file, such
    as the Vim swap file `.action.tsx.swp` and the backup file `action.tsx~`.
  - **Bundle settings:** the persisted settings of a `bundle` request: entry
    files, renderer, stories files, resolution settings, source root,
    configuration directory, and repository roots.
- **Background:**
  - The plan reuse change, commit `efb17e824`, lets a Serve edit skip the
    native esbuild attempt when a Rust check proves its plan record current.
    A Serve edit captures nothing and stores nothing. So a record changes
    only with a captured compile, and Serve makes none after its first
    published state.
  - Why an editor file makes the record stale:
    - The reuse evidence keeps each directory where the resolver can look
      for a candidate, at `docs/protocol/mokly-sidecar-recipes.md:72`. A
      recorded directory keeps every entry, its kind, and the target of each
      link, at line 80.
    - The capture records a candidate's directory in `candidate` at
      `packages/mokly/src/sidecar/resolution-evidence.ts:135` to line 143.
      `candidate` and `directory` at
      `packages/mokly/src/sidecar/physical-inputs.ts:166` to line 191 read
      the listing. `readDirectory` at
      `packages/mokly/src/sidecar/physical-input-reader.ts:131` to line 189
      keeps every entry.
    - Before each `serveEdit` request, `edit_plan` at
      `crates/mokly-render/src/bundle_attempt.rs:61` to line 72 checks the
      record with `physical_inputs::current` at
      `crates/mokly-render/src/physical_inputs.rs:113`. The directory branch,
      at lines 64 to 96, compares the whole listing.
    - A new file in a recorded directory therefore makes the listing differ.
      Then the whole record is unusable, at
      `docs/protocol/mokly-sidecar-plans.md:104`.
    - In the measured fixture, no import can select either editor file.
      Neither name is an import path plus a configured extension, and
      neither is an index file.
  - Why an added catalogue entry finds no record:
    - `Records::get` at `crates/mokly-render/src/edit_plans.rs:32` to line 39
      compares every bundle setting except the evaluation digest.
    - The settings include `entry_files`, at
      `crates/mokly-sidecar/src/methods.rs:66`. An added entry changes them,
      so no kept record matches the new settings. New settings need their
      own record, at `mokly-sidecar-plans.md:104` to line 105.
    - The new entry file can also change a recorded directory list. Nobody
      checked which recorded inputs changed in that case.
  - One measurement sequence ran on 2026-11-18:
    - It used the release binary of `efb17e824` with its matching sidecar
      dist, on a machine with four logical CPUs and 8 GiB RAM.
    - Each case ran one fresh Serve process with one worker and a fresh
      product cache. The runs were not interleaved.
    - Each case created its files after the first captured compile. It kept
      them through one setup edit and restore, then three measured cycles.
    - Each edit changed the text of
      `examples/basic/src/components/action/action.tsx` in a scratch copy.
      Each restore wrote back its exact original bytes. Each step waited for
      a new live generation and ready Changes.
    - The Serve RSS covers the CLI and its descendants. The whole-harness RSS
      had a fixed safety stop of 4,500,000 KiB.
  - Editor files case: `.action.tsx.swp` and `action.tsx~` beside
    `action.tsx`.
    - The setup edit and the setup restore each fell back to native-first,
      with two esbuild compiles and one classification.
    - All 3 of 3 measured edits fell back. Each made two esbuild compiles,
      one classification, and no compile failure.
    - Edit to Changes ready: 3.0735, 2.8657, and 2.9245 s.
      `catalogue.bundle`: 1,242, 1,133, and 1,146 ms.
    - Measured restores: 1.9697, 1.8237, and 1.8698 s. Each made no compile,
      because the existing live reuse served it.
    - Peak Serve RSS: 1,816,880 KiB. Peak whole-harness RSS: 3,702,564 KiB.
  - Added entry case: a new entry file,
    `examples/basic/specs/example/screens/plan-reuse-retained-entry.mockup.tsx`.
    - The first attempt left out the required `relatedDocs` field and made
      no measured cycle. A fresh run with a corrected file gave the values
      below.
    - The setup edit fell back to native-first. The setup restore made no
      compile.
    - All 3 of 3 measured edits fell back. Each made two esbuild compiles,
      one classification, and no compile failure.
    - Edit to Changes ready: 3.8659, 3.2215, and 3.0739 s.
      `catalogue.bundle`: 1,308, 1,359, and 1,245 ms.
    - Measured restores: 2.2818, 2.0325, and 1.8145 s, each with no compile.
      The new entry stayed in Changes through each restore.
    - Peak Serve RSS: 1,888,788 KiB. Peak whole-harness RSS: 3,715,192 KiB.
  - Contrast case, with the same binary, fixture, and edits but no retained
    file:
    - Each measured edit used the plan, with one esbuild compile and no
      classification.
    - Edit to Changes ready: 3.2079, 2.9270, and 2.6233 s.
      `catalogue.bundle`: 1,014, 925, and 771 ms.
    - Peak Serve RSS: 1,719,424 KiB. Peak whole-harness RSS: 3,645,184 KiB.
    - These are single runs. Their end-to-end times overlap, so they do not
      give the size of the loss. The `catalogue.bundle` times show the
      extra bundle work of a fallback.
  - On mokly-cloud, plan reuse cut each edit from 4.18 s to 3.13 s, in the
    performance orchestrator's accepted measurement of 2026-11-18.
  - The decisions in force:
    - The performance orchestrator kept whole-record invalidation in the
      plan reuse change on 2026-11-18.
    - `docs/protocol/mokly-sidecar-plans.md:106` to line 108 rejected a check
      of each plan entry and a record key of the resolution settings alone,
      "without a measured need". This item gives the measured need.
    - `docs/protocol/mokly-sidecar-recipes.md:96` to line 97 says that a
      reuse check compares recorded entries with the filesystem, "so it
      copies no resolver rule".
  - Alternatives for a later choice. Nobody measured any of them:
    - **A.** Keep whole-record invalidation. Every edit falls back while an
      editor file stays in a recorded directory. A new entry finds no record.
    - **B.** Key the record by the resolution settings alone, without
      `entry_files`, `stories_files`, and `renderer`. A new entry can then
      match the record while its evidence stays current. B alone may not
      restore reuse in the added entry case, because the new file can also
      change a recorded directory list. B does not change the editor files
      case. It changes the decision at `mokly-sidecar-plans.md:106`.
    - **C.** Check the evidence of each plan entry. Keep the evidence indices
      of each resolution request, send only the entries whose evidence is
      current, and give a stale entry full resolution. It needs an evidence
      index, a new Rust check, and more oracle cases. It changes the decision
      at `mokly-sidecar-plans.md:106`.
    - **D.** The candidate-name direction: directory evidence records only
      the candidate names that resolution can select, instead of every
      directory entry. An editor file that no import can select then leaves
      the evidence current. It changes the rule at
      `mokly-sidecar-recipes.md:80`, and it conflicts with the decision at
      line 96 that the reuse check copies no resolver rule. The same
      evidence also serves compiled-result reuse and the bundle cache. It
      must keep the detection of a hidden higher-priority candidate.
  - A refresh of the record by a later captured compile, such as the pause
    compile C4, belongs to `plans/follow-ups/serve-pause-warm-head.md`. That
    refresh stays outside the plan reuse change and outside this item.
- **Task:**
  1. Repeat both cases on a release build in interleaved rounds. Add the
     contrast case without retained files.
  2. Record which recorded inputs change in each case: each directory list
     and each bundle setting.
  3. Measure B, C, and D against A on both cases. Give the native-first
     count, the esbuild compiles, edit to Changes ready, the bundle spans,
     the record bytes, and peak RSS.
  4. Ask the performance orchestrator before a choice that changes a
     protocol requirement or a decision in force. B, C, and D each change
     one.
  5. Implement the chosen alternative with tests for both cases. Keep every
     plan, oracle, bound, invalidation, warm-start, and bundle cache test.
  6. Keep these requirements: equal output, recorded inputs, and errors
     against the native-first path. Keep both 8 MiB bounds, no capture or
     storage on edits, one esbuild call with a current plan, and the disk
     rules of `docs/protocol/mokly-base-cache.md`.
  7. Update `docs/protocol/mokly-sidecar-plans.md`,
     `docs/protocol/mokly-sidecar-recipes.md`, and the area READMEs when a
     rule or an entry point changes.
  8. Measure the result against `main` under the same method, and on
     mokly-cloud under the accepted method. Run `cargo xtask check`.
- **Impact if no action:** While an editor keeps a swap or backup file in a
  recorded directory, each edit of the session falls back to two esbuild
  compiles and one classification. A session with an added catalogue entry
  falls back in the same way. Such a session loses the gain of plan reuse,
  which was 1.05 s per edit on mokly-cloud.
- **Needs:** A release build of the commit under test with its matching
  sidecar dist. A machine with at least four logical CPUs and 8 GiB RAM, on
  which no other build, test, or timing run is active. A checkout of the
  mokly-cloud repository for the final measurement.
- **Done when:**
  - Both cases and the contrast case are measured under A and under each
    measured alternative.
  - Either the chosen alternative ships and lowers the native-first edit
    count of a measured case, or the performance orchestrator keeps A with
    that evidence.
  - No measured case gets slower edits or a higher peak RSS than under A.
  - The oracle tests prove equal output, recorded inputs, and errors. The
    gate passes.
- **Related:**
  - `plans/follow-ups/serve-pause-warm-head.md`, linked alternatives. Its
    pause compile C4 would refresh a stale record. It stays a separate
    item.
  - `plans/follow-ups/in-process-resolution-coherence.md`, the same code.
    Its stale-selection windows depend on the directory lists that D would
    narrow.
  - `plans/follow-ups/serve-plan-record-start-cost.md`, the same code. Both
    items change the plan record, and C or D can change its size.
  - `plans/follow-ups/ancestor-churn-disables-durable-capture.md`, the same
    native-first fallback. There, the first capture keeps no plan record.
    Here, a kept record goes stale at the edit check.
