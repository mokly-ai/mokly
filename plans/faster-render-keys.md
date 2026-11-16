# Build render input keys without repeating shared work

Status: Active. On branch `calummoore/faster-render-keys`, no pull request
yet. The pull request that completes the work deletes this plan, as the
`plans` skill says.

Each entry module has one render input key, under the rule of
[invalidation through the render graph](../docs/protocol/mokly-watch.md#invalidation-through-the-render-graph).
`RenderKeys::build` in `crates/mokly-graph/src/render_inputs.rs` computes the
keys during graph preparation, on every Serve start, every watched rebuild,
and every base preparation of Changes. For each entry module it collects the
module's closure plus the whole renderer closure (or the Storybook preview
closure), looks up the resolution chain of every member, and serializes every
member record into one JSON value that it hashes. Every entry repeats the
renderer part. A CPU profile of Serve on the `mokly-cloud` catalogue (about
190 entry modules, a renderer closure of about 2,000 modules) on 2026-11-16 put
about 13% of the core's CPU under `RenderKeys::build`, about 1.2 s of
single-threaded time for each build, mostly in building the resolution sets
and the member sets. The evidence is in `.context/faster-render-keys/`.

The change computes the parts that entries share once for each build: the
records, the renderer and preview closures, their sorted member records, and
their resolution sets. Each entry then adds only the members that its own
closure brings, by a merge of sorted lists, and streams the same JSON value
into the hash without building an intermediate value. The keys stay byte for
byte equal to today's keys, so no key moves for any input, which the
protocol rule requires: a key moves when one of its listed inputs changes,
and only then. The change does not alter any input, any caller, or any
protocol rule.

Decisions:

- 2026-11-16, user: keep optimising the speed and the reliability of Changes,
  merge without asking, and make no change that can exhaust a machine's
  memory. This approves the plan and the merge.
- 2026-11-16, my call: the keys stay byte-identical. Rejected: a key over a
  digest of the renderer closure plus the entry's own part, because a module
  that moves between the two parts would move the key without an input
  change, against the protocol rule. Rejected: a Merkle digest over the module
  graph, for the same reason and because the resolution and binding sets are
  unions over the closure.

Contract owners: none. The protocol rule does not change. The
[mokly-graph README](../crates/mokly-graph/README.md) names `RenderKeys`; it
changes only if its description of the work goes stale.

## Milestone 1: Shared key parts

Depends on: none

- [x] Precompute the shared parts once for each `RenderKeys::build`, and give
      each entry only its own extra members. Keep the closure, resolution,
      binding, and fallback rules exactly as they are.
- [x] Stream the key JSON into the digest without an intermediate
      `serde_json::Value`, with byte-identical output.
- [x] A test that compares every key of the new build with a reference
      implementation of today's algorithm, kept in the test module, on a
      generation with a shared renderer closure, a stories file with a
      preview, re-exported bindings, a cycle in the module graph, and an
      unnamed renderer. Show that the test fails when one shared resolution
      file is left out of an entry.
- [x] The existing tests under `crates/mokly-graph/src/_tests_/render_*`
      pass unchanged.

## Milestone 2: Measurement

Depends on: 1

- [x] Release builds of `main` and of the branch. On `mokly-cloud`, Serve
      start and one edit, before and after: `catalogue.validate`,
      `graph.prepare`, and `watch.action`, and the share of
      `RenderKeys::build` in a CPU profile, under
      `.context/faster-render-keys/`.
- Evidence: `.context/faster-render-keys/measurements.md`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 1, 2

- [ ] Run the targeted tests, the early check, and the repository suite named
      in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
