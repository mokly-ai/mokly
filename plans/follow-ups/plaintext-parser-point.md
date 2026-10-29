# Let the parser choose the plaintext point

- **Severity:** Low. **Effort:** Large.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 98 (engine review 2 finding 2, option C, a class
decision): let the parser choose the plaintext point. Four cases of
serializer-versus-parser divergence so far: hub review 1 finding 2,
`b0842cad`, and review 2 findings 2 and 4. Severity Low, effort Large
for B. Options: A, keep the fail-safe check that retries with all text
escaped when the parser disagrees, which engine fix round 3 applied on
`rebuild/defaults-engine` as its option B, Small (estimate); B,
serialize first with all text escaped, find the first HTML `plaintext`
element by its repair id, and write raw text only after it, Large.
Recommended: A now, and B as a post-merge follow-up.

- User decision 98 (2026-10-21): B, in parallel and non-blocking. Item 98
  now also covers the source-identity redesign: the M15 follow-up "carry
  source identities through HTML5 token processing for all elements", F19
  review finding 2 B, and F21 review finding 5. B builds one HTML pipeline
  in which html5ever's tree builder reads the tokens of the token pass,
  chooses every text mode, and gives each element its source position.
  Work: W6 on `rebuild/html-pipeline`. It must not delay the final pull
  request.
- Moved here from Milestone 14 on 2026-10-22. User decision 147 B keeps
  98 B post-merge. The source identity work landed in `dc4d8127`. The
  one-tokenizer boundary decision remains open. No default has been applied.
- The user's decision B on the one-tokenizer item (2026-10-26) completed
  that part in `3c90b1e1`: the catalogue checks and the tree read the tokens
  of one driver, and the tree builder chooses every text mode. Still open
  under 98 B: serialization still predicts the plaintext point and keeps the
  escaped-text retry, instead of option B's escaped first pass that finds
  the HTML `plaintext` element by its repair id.
- User decision (2026-10-28): B. The serializer part stays an open
  follow-up, and item 98 stays unticked.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5455).
