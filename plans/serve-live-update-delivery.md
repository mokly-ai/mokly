# Serve live-update delivery

Status: Active. On branch `calummoore/mokly-viewer-live-update-lpaj`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

After each source edit, Serve publishes about five revisions. The viewer then fetches the whole index of 1.19 to 1.31 MB after each event, and every reloaded frame fetches its stylesheets and its font again, because Serve sends `no-store` on every response. After a rebuild, the background pass renders the changed views in catalogue order, so a frame of the open viewer can wait up to about 130 ms behind other views. This change makes Serve send fewer bytes and answer the open viewer's documents sooner. It keeps every published byte, the set of rendered views, the final state of the viewer, and the static output. The viewer's own refresh work is a separate change in its own pull request.

Measurements of `main` 3362e250d on mokly-cloud 194fdb78, 4 vCPU, warm edits 2 to 4, A/A arms: 6.51 MB and 29 requests per edit, 4.6 full index bodies per edit, the first frame paint 161 ± 28 ms after the page's first event (Chrome clock), the last frame paint 32 to 105 ms later in 7 of 12 edits, one frame document waiting 72 to 131 ms for the pass in 8 of 24 edits, the Changes pane paint 123 to 130 ms after the published ready Changes. The evidence is under `.context/viewer-live-update/`.

User decisions of 2026-11-22, by the performance orchestrator (Cal), after the measurements and an options check:

- Index bytes: gzip for JSON responses (option A), with the protocol text P2. Rejected: fewer publications (usage arrives later), a publication delta and an index split (format changes, Large), unindented JSON (changes canonical bytes). Conditions: compress at most once for each publication, off the publication path, on the first request that accepts gzip, then reuse the bytes until the publication is replaced; a fast level; `gzip;q=0` is not accepted; the compressed bytes go with their publication.
- Unchanged resources: strong validators with `no-cache` and 304 for generated stylesheets and assets and authored assets (option A, P3), and an immutable cache policy for the files of a comparison generation (option E, P3b). Rejected: content-addressed URLs (Large, touches core crates and the static output), an in-place document swap (needs per-stylesheet versions), a short `max-age` (stale bytes). Conditions: each ETag is computed once for each resource version; a test shows that a changed stylesheet at the same URL never gets a 304 for its old ETag.
- Pass order: the routes requested since the previous rebuild start first, most recent first, then catalogue order (option A, P4). Rejected: a viewer request that names its routes (new boundary), a worker kept for requests (slows Changes). Conditions: warnings stay in catalogue order, the set of rendered views and every published byte stay the same, the requested-route list is bounded by the catalogue; a test shows that a requested view renders first and that the final publication equals catalogue order.
- The official check of this pull request: bytes per edit at least 50% lower; the last frame paint (viewer part, Chrome clock) at least 20 ms sooner and the first frame paint not later than +5 ms (12 interleaved warm rounds, edits 2 to 4); the Changes pane paint not later; published Changes not later than +20 ms (untimed, 12 rounds); the core CPU per session not more than +2%; Serve's whole-tree peak within 2% over paired cold sessions; the same final state and the same static output.

Design calls (mine, 2026-11-22):

- P3b also narrows the sentence of `mokly-comparison-serving.md` that gives `no-store` for every generation route to the generation root, and `mokly-runtime.md` links the generation rule, so that the pages do not contradict P3b.
- Error responses keep the identity encoding. P2 covers the JSON content of the routes, and an error body is not publication content.

Contract owners:

- [Shell delivery](../docs/protocol/mokly-shell-delivery.md), Routes.
- [Runtime](../docs/protocol/mokly-runtime.md), Routes.
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md), Generation And Serving.
- [Background pass](../docs/protocol/mokly-on-demand-background.md), Window And Lookup.
- The [mokly-server README](../crates/mokly-server/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

The approved protocol text P2, P3, P3b, and P4 goes into the four pages.

- [ ] P2 in `docs/protocol/mokly-shell-delivery.md`, Routes.
- [ ] P3 in `docs/protocol/mokly-runtime.md`, Routes, with a link to the generation rule. Split the page into linked pages if it passes 250 lines.
- [ ] P3b in `docs/protocol/mokly-comparison-serving.md`, with the generation-route sentence narrowed to the root.
- [ ] P4 in `docs/protocol/mokly-on-demand-background.md`, Window And Lookup.

## Milestone 2: Compressed JSON

Depends on: 1

- [ ] Red tests: a JSON route answers with `Content-Encoding: gzip` and `Vary: Accept-Encoding` when the request accepts gzip, and its body decompresses to the identity bytes; `gzip;q=0` and a missing `Accept-Encoding` get the identity body with `Vary`; HEAD gives the same headers without a body; one publication compresses each body at most once.
- [ ] Compress lazily, once for each publication and file, at a fast level, off the publication path, and drop the bytes with the publication.

## Milestone 3: Validators and cached generation files

Depends on: 1

- [ ] Red tests: generated stylesheets and assets and authored assets carry a strong `ETag` and `Cache-Control: no-cache`; a matching `If-None-Match` gets 304 without a body on GET and HEAD; a changed stylesheet at the same URL never gets a 304 for its old `ETag`; generation files carry `Cache-Control: private, max-age=31536000, immutable`, and the generation root keeps `no-store`; generated documents keep `no-store`.
- [ ] Compute each `ETag` once for each resource version.

## Milestone 4: Requested routes first

Depends on: 1

- [ ] Red tests: after a rebuild, a view whose document was requested since the previous rebuild starts first, the most recent first; the final publication and the warnings follow catalogue order; the set of rendered views is the same; the requested-route list holds only routes of the catalogue.
- [ ] Record the requested document routes, bounded by the catalogue, and start the pass with them.

## Milestone 5: Verification, commit, review, and pull request

Depends on: 2, 3, 4

- [ ] Update the [mokly-server README](../crates/mokly-server/README.md) Key Code for the new entry points.
- [ ] Run the targeted tests, the early repository check, and a Serve smoke test.
- [ ] Prove the same static output of `examples/basic` against `main`, and save the diff under `.context/viewer-live-update/`.
- [ ] Measure the branch against `main` on mokly-cloud with probe v3: bytes, first and last frame paint, Changes pane paint, published Changes, core CPU, memory peak.
- [ ] Commit with Conventional Commits and push the branch. Send the SHA to the performance orchestrator.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings, then apply the fix rule: fix the `fix now` findings, record follow-up items under `plans/follow-ups/` for the rest, re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Its description gives the decisions and the design calls of this plan with their dates, a permalink to this plan, and the follow-up items that the change adds. Let CI run the complete gate.
