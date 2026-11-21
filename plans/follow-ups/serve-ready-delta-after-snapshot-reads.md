# Attribute the Serve ready delta after snapshot reads

- **Severity:** Low. **Effort:** Medium. **Confidence:** Low. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-21, from the branch `calummoore/mokly-render-store-read-lock-rofg`, the cloud acceptance of product commit `4ab7e9da749e4abd303fbf1adaf826583287ece8`.
- **Location:** `crates/mokly-cli/src/entry_serve.rs:43` and line 237, `crates/mokly-compare/src/render_writer_control.rs:92` to line 101 and line 137 to line 175, `crates/mokly-compare/src/render_store_state.rs:16` to line 44 and line 99 to line 160, and `crates/mokly-compare/src/render_image.rs:32` to line 57.
- **Reason:** No scan, lookup, batch copy, or store wait moved onto the ready path. Cloud child-span traces must identify the measured cost.

- **Terms:**
  - **Ready time:** the `serve.ready` timing span. It opens at `crates/mokly-cli/src/entry_serve.rs:43` and closes at line 237, before Serve renders a document.
  - **Writer thread:** the `mokly-documents` thread that `DocumentWriter::start` spawns in `crates/mokly-compare/src/render_writer_control.rs`.
  - **Store preparation:** the work of the writer thread before its write loop. It hashes the running image, span `render.store.identity`, and indexes the stored segments, span `render.store.initialize`.
  - **Snapshot reads:** the design call of 2026-11-21 that a read loads the last published index snapshot and takes no lock. The section "Reads" of `docs/protocol/mokly-render-store.md` states it.
  - **Timing records:** the JSON lines that `--debug-timings` writes to stderr. Each span end gives `stage`, `id`, `parentId`, `elapsedMs`, and `durationMs`.
- **Background:**
  - The change replaced the index mutex of `CachedDocuments` with an atomic snapshot pointer and a separate nonblocking maintenance mutex. A read takes no index lock and never waits for store work.
  - The cloud check used a control core from cb233fb50 and a candidate core from 4ab7e9da7. Both arms used e69db4ce8 dist and separate caches. Warm one-line ready went from 1,567 to 1,688 ms, with four of four pairs slower. Warm unchanged ready went from 1,675 to 1,703 ms.
  - In the same runs, first Changes improved from 5.50 to 5.12 s for one-line and from 5.30 to 5.12 s for unchanged. Edits went from 2.14 to 2.15 s and from 2.19 to 2.21 s.
  - Store misses per run fell from 106, 22, 13, and 6 to 98, 7, 1, and 0 for one-line. They fell from 9, 5, 7, and 5 to 1, 0, 0, and 0 for unchanged.
  - The ready path calls no store function. `DocumentStore::load` has one caller, `Session::raw_lookup` in `crates/mokly-graph/src/session_lookup.rs`, and it runs only for a document render. Renders start after line 237 of `entry_serve.rs`.
  - Writes start only after the first Changes result. The section "Writes" of `docs/protocol/mokly-render-store.md` states it.
  - The store preparation runs on the writer thread before and after the change. The main thread joins that thread only at command end, in `DocumentWriter::shutdown`.
  - Constructor setup remains constant metadata work. The changed inventory publication runs on the writer thread. It publishes the finished index once with `Arc::new` and an atomic store. A local allocation proof measured +232 requested bytes.
  - The dev build of the native binary is 0.07% larger with the change. `npm run build` builds the debug profile, so SHA-256 runs without optimization.
  - Locally, the identity hash of a 131 MB dev binary took 1.8 to 2.6 s. The store preparation overlapped the whole ready window.
  - Locally, three warm restarts of one binary gave ready times of 3,420 to 4,140 ms. Most of the spread was in `catalogue.validate` and `catalogue.bundle`.
  - With independent and equally likely pair directions, four of four has a one-sided sign-test probability of 1/16. This does not identify the cause.
  - A static build accepts `--debug-timings` and starts no store writer. Only `crates/mokly-cli/src/serve_services.rs` creates the writer.
- **Task:**
  1. Build two native binaries with one profile: main at the merge base, and main with the change. Use the same sidecar, viewer, Node, fixture, and sidecar count. Record the profile and the SHA-256 of each binary.
  2. On the cloud runner of the acceptance check, run at least eight alternating pairs of warm one-line restarts and eight of warm unchanged restarts, with `--debug-timings`.
  3. Run an A/A control: the main binary in both arms of the same alternating schedule.
  4. For each run, record `serve.ready` and its child spans: `config.load`, `catalogue.discover`, `catalogue.validate`, `catalogue.bundle`, `graph.prepare` and its stages, `index.build`, `detail.build`, and `sidecar.spawn`.
  5. For each run, record the start and end of `render.store.identity` and `render.store.initialize`. Record the segment count, the record count, and the data bytes of the render store before the start. Record the CPU count.
  6. Run a static build with `--debug-timings` for each binary, with the same fixture. Compare the shared preparation spans. A static build has no writer thread, so this separates code layout from writer contention.
  7. Compare the ready delta with the A/A spread. Name each child span that changes. Give the overlap of the store preparation with the ready window, for each arm.
- **Impact if no action:** The record keeps an unexplained warm ready delta of up to 121 ms on a 1.6 s start. A real cost in an unchanged path can stay hidden.
- **Needs:** The cloud acceptance harness and runner, two native builds of one profile, and the timing flag `--debug-timings`.
- **Done when:** A report gives the ready delta of each scenario with the A/A spread, each changed child span, and the store preparation overlap of each arm. Then one of these is true:
  - The delta is inside the A/A spread, and this item is deleted.
  - The delta is real and follows the store preparation. A Needs-decision item replaces this one. Its options keep the snapshot-read rule: no index lock and no wait in a read, and no miss for an indexed document because another operation uses the index. Its options include a lower CPU priority for the writer thread during preparation, optimized hash crates in the dev profile, and no change. It says that a later index publication adds misses after ready, because a lookup before preparation ends is a miss.
  - The delta is real in a span that does not follow the store preparation, or it also shows in the static build. An item for that span and its owner replaces this one.
