# The fake-store test rule appears only in review

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the review of branch
  `calummoore/mokly-postcss-reuse-across-edits-pra6`, pull request #459. The
  independent check of review finding 1, a test with a hand-written fake
  cache, listed this gap as a new problem outside the scope.
- **Location:** The shared skills repository `Firna-AI/skills`, checked at
  commit `14c2aebb5`: `skills/implementation-review/references/review-prompt.md:10`
  to line 13 and `:29` to line 33, `skills/implementation-review/SKILL.md:39`
  to line 43, `skills/testing/SKILL.md:13` to line 14, `:88` to line 89, and
  `:134`, `skills/rust/SKILL.md:36` to line 38,
  `skills/rust/references/architecture.md:81` to line 109, and
  `skills/typescript/SKILL.md:63` to line 70.
- **Reason:** The gap is in the shared skills repository, and a Mokly branch
  does not change that repository.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Hand-written fake store:** test code that keeps its own map, list, or
    counter to stand for a store or a cache. It often sits behind a mock of the
    store's trait.
  - **Review prompt:** the prompt of the `implementation-review` skill that each
    first-pass reviewer gets. It defines a weak test.
  - **Authoring skills:** the `testing`, `rust`, and `typescript` skills. Agents
    read them before they write a test.
  - **`unimock`:** the Rust mocking library that the `rust` skill requires at
    trait boundaries in unit tests.
  - **`MemoryCache`:** the production in-memory render cache of Mokly in
    `crates/mokly-graph/src/cache.rs`. It has a byte bound, LRU eviction, and
    hit, miss, and eviction counts.
- **Background:**
  - The review prompt says: "A weak test cannot fail, was weakened or
    special-cased to pass, is over-mocked, or uses a hand-written fake store."
    A reviewer reports such a test as a finding.
  - The `testing` skill says that the `rust` and `typescript` skills "give the
    layout, the runner, and the test doubles".
  - The own test-double rules of the `testing` skill cover two cases. A value
    that goes from a double straight to an assertion checks only the double.
    The replacement of the code under test by a double needs the user. Neither
    rule names a fake store.
  - The `rust` skill requires `unimock` at trait boundaries, also for a trait
    with one implementation in the same crate. Its "Mocking" section lists the
    clause kinds. It says that integration tests can use real implementations.
    It does not say that a clause must not answer from shared state that
    stands for a store.
  - The "Tests" section of the `typescript` skill says: "Inject or stub those at
    the module boundary." It does not name fake stores.
  - So an author who follows the `rust` skill can back a `unimock` mock of a
    store trait with a map. The first rule that rejects that test is in the
    review prompt.
  - A fake store drifts from the production store:
    - It has no byte bound, no eviction order, and no statistics.
    - A test clears the map to stand for an eviction. The later miss is then
      inferred, not observed.
    - `unimock` 0.6.8 runs the default method of the trait when a method has no
      clause. It fails the test when that method has no default.
    - The Mokly trait `RenderCache` gives `contains` the default `false`, and it
      gives `stats` no default. See lines 64 to 73 of
      `crates/mokly-graph/src/cache.rs`.
    - So a fake that answers only `get` and `insert` from its map returns
      `false` from `contains` for a key that `get` returns. A `stats` call fails
      the test.
  - A test can use the production store instead. In Mokly,
    `MemoryCache::new(total_bytes, compact_ceiling)` at
    `crates/mokly-graph/src/cache.rs:92` accepts a small bound. The test can
    cause a real eviction and read the hit and miss counts from `stats()`.
- **Problem:** The authoring skills do not state the review rule against
  hand-written fake stores. The mocking rule of the `rust` skill makes a
  map-backed mock look correct. Authors meet the rule only at review.
- **Impact if no action:** Each new fake store costs a review finding, a
  finding check, and a fix round. A map-backed mock can take another path than the production store. It can
  also fail when a caller uses a store method that its clauses do not cover.
- **Root question:** How do test authors learn, before review, that a test must
  not use a hand-written fake store?
- **Options:**
  - **A.** Add the rule to the section "Write one test" of
    `skills/testing/SKILL.md`. Proposed text: "Do not keep a map, a list, or a
    counter that stands for a store or a cache. Use the production store, set
    up small for the test. Observe its state through its public API." Every
    author reads this skill before a test. The mocking text of the `rust`
    skill still makes a map-backed mock look correct. Effort: Small.
  - **B.** Do A. Also add one bullet to the section "Mocking" of
    `skills/rust/references/architecture.md`, and one line to its summary in
    `skills/rust/SKILL.md`. Proposed text: "Do not back store clauses with shared state that
    implements a hand-written store. When the
    behaviour depends on what a store keeps, use the production in-memory store
    with a small bound." Add the rule of A to the section "Tests" of
    `skills/typescript/SKILL.md`. Keep the review prompt as it is. Effort:
    Small.
  - **C.** Give the existing weak-test definition one home: a section of
    `skills/testing/SKILL.md`. Keep every current criterion: a weak test cannot
    fail, was weakened or special-cased to pass, is over-mocked, or uses a
    hand-written fake store. Add no criterion, lint, or other restriction.
    - The section names the alternative to a fake store: the production store,
      set up small and observed through its public API.
    - The test-double text of `skills/rust/SKILL.md`,
      `skills/rust/references/architecture.md`, and `skills/typescript/SKILL.md`
      refers to that section.
    - The review prompt pastes that section after a `---` line, as it pastes
      the outcome rules of the `decisions-and-findings` skill today. Its
      sentence at lines 29 to 33 then refers to the pasted section.
    - The work also adapts the two loading instructions, which today add only
      the outcome rules. They are lines 10 to 13 of the review prompt and step
      1 of "Running the review" in `skills/implementation-review/SKILL.md`, at
      lines 39 to 43.
    - Authors and reviewers then read one text. It changes how each review
      prompt is put together, for each repository that uses the skills.
      Effort: Medium.
- **Left out:**
  - Change nothing. It fails the goal, because authors keep meeting the rule
    only at review.
  - A lint or a check that finds map-backed mocks. It adds a new check, which
    only the user can add. The review rule already sets the policy.
  - Remove the rule from the review prompt. It drops a policy in force and lets
    fake stores pass review.
  - Add the rule to the `AGENTS.md` of Mokly only. The gap is in the shared
    skills, so other repositories keep it, and Mokly would copy a shared rule.
- **Wider fix:** C. One text for authors and reviewers prevents this class of
  gap for each weak-test criterion.
- **Previous examples:**
  - `crates/mokly-graph/src/_tests_/validation_cache_tests.rs:49` to line 92
    puts a `BTreeMap` behind `RenderCacheMock::get` and
    `RenderCacheMock::insert`. Its last change is commit `940ddd742` of
    2026-11-20, "fix(render): invalidate stylesheets when resolver inputs
    change (#384)". The file came from commit `d935e6a66` of 2026-10-25.
  - `crates/mokly-graph/src/_tests_/prefetch_eviction_tests.rs:23` to line 52
    puts a `BTreeMap` behind `RenderCacheMock::contains`, `get`, and `insert`.
    The test clears the map to stand for an eviction. The file came from commit
    `77021d88c` of 2026-11-21, "perf(changes): integrate miss-first base capture
    with render store (#452)".
  - Pull request #459, at commit `b67c27ef9`, added a map-backed cache helper at
    `crates/mokly-render/tests/integration/postcss_retirement_tests.rs:24`. The
    test cleared the map to stand for an eviction. Its review raised the test as
    a Low finding under the review prompt rule. The same branch replaced the
    helper with the production `MemoryCache`.
  - These examples show the gap. This item does not change them.
- **Related:** None.
- **Recommendation:** C. As the structural wider fix, it gives authors and
  reviewers one text, so no current weak-test criterion can again exist only
  in review.
- **Action:** fix after merge, apply C, because the work belongs to a separate
  branch of the shared skills repository.
