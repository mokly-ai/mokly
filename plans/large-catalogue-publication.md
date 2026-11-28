# Large Catalogue Publication

Status: Active. On branch `calummoore/catalogue-size-plan-to-fit-the-upload-pjqr`, no pull request yet. Every decision of this plan waits for the user, and no implementation is approved. The plan-only pull request keeps this plan. The last implementation pull request deletes it, as the `plans` skill says.

Mokly Cloud refuses the catalogue of a large project. On 2026-11-27, the repository `Firna-AI/conductive` at commit `3371d05f` built with `@mokly/mokly` 0.21.0 into 1,746 MB in 11,030 files. The receiver accepts 512 MiB, about 537 MB, of declared bytes. The index was 48.7 MB with 2,162,642 JSON nodes, and the receiver accepts 8 MiB and 262,144 nodes. A pull-request build wrote 26,070 files, above the ceiling of 20,000, because it copies every document two more times. Conductive had 72 entry files on 2026-11-08 and 664 on 2026-11-27.

This plan proposes two changes together. Mokly writes less in four steps: compact canonical JSON, entry fields out of the index, usage records stored once, and fewer snapshots. The cloud counts each stored file once, and it sizes its quotas for a growth target. Every recommendation below is a proposal of 2026-11-27, not a choice.

The plan does not change the build template, the attempt deadline, or the memory of the native process. The workspaces "Build capacity: bigger template and deadline" and "Build capacity: bounded render memory" own them. The plan does not render both colour schemes from one document. It leaves the rule of 2026-10-27 for equal before snapshots to `plans/follow-ups/skip-equal-before-snapshots.md`.

On 2026-11-27 the workspace "conductivity build issue" gave the user its item 1 with three options:

- A. Raise the receiver limits.
- B. Make the output smaller in Mokly, with compact JSON and bounded or deduplicated usage records.
- C. Conductive cuts its catalogue.

The user asked for a brainstorm of item 1, and then for this plan. The parent workspace read that as option B. This plan keeps the root question open as item 1, because the brainstorm found more approaches.

Contract owners:

- [Catalogue serialization](../docs/protocol/mokly-catalogue-serialization.md), [format versions](../docs/protocol/mokly-format-versions.md), [shell delivery](../docs/protocol/mokly-shell-delivery.md), [catalogue](../docs/protocol/mokly-catalogue.md) and [component usage records](../docs/protocol/mokly-component-usage-records.md).
- [Changes serving](../docs/protocol/mokly-changes-serving.md), [export delivery](../docs/protocol/mokly-export-delivery.md) and [comparison panes](../docs/protocol/mokly-comparison-panes.md).
- [Upload validation](../docs/protocol/mokly-upload-validation.md), the cloud [publication upload validation](../docs/protocol/cloud/publication-upload-validation.md) and [artifact compatibility](../docs/protocol/cloud/mokly-artifact-compatibility.md).
- The [model README](../crates/mokly-model/README.md), the [static README](../crates/mokly-static/README.md), the [compare README](../crates/mokly-compare/README.md), the [contract README](../crates/mkc-mokly-contract/README.md) and the [viewer README](../packages/viewer/README.md).
- The runbooks [environment](../docs/ops/environment.md) and [release cutover](../docs/ops/mokly-release-cutover.md).

## Measurements

This workspace rebuilt conductive at `3371d05f` with `@mokly/mokly` 0.21.0 on 4 vCPU and 7.7 GiB. The scripts and the reports are under `.context/large-catalogue-publication/` of this workspace. Sizes are in MB of 1,000,000 bytes. Compact sizes re-encode the JSON without whitespace.

| Fact                                               | Value                                             |
| -------------------------------------------------- | ------------------------------------------------- |
| Current-only output                                | 1,746.2 MB in 11,030 files                        |
| Distinct files of that output                      | 1,689.5 MB in 7,883 files                         |
| The same files with gzip                           | 198.9 MB                                          |
| Entry details                                      | 1,246.2 MB, 414.2 MB compact                      |
| Index                                              | 48.7 MB, 20.8 MB compact                          |
| Index JSON nodes                                   | 2,162,642                                         |
| Index with tables for controls and prop schemas    | 4.7 MB, 393,285 nodes                             |
| Index without controls, prop schemas and props     | 2.85 MB, 150,688 nodes                            |
| Rendered HTML                                      | 395.7 MB in 6,884 pages                           |
| HTML: Mokly marker comments                        | 85.4 MB in 732,976 comments                       |
| HTML: marker `path` and `props` attributes         | 34.2 MB                                           |
| HTML: frame probe templates                        | 32.6 MB                                           |
| HTML: collected style blocks                       | 46.9 MB, 3.7 MB distinct                          |
| HTML: inline SVG                                   | 60.2 MB, 0.26 MB distinct                         |
| Light and dark pages equal after the scheme marker | 0 of 3,442 pairs                                  |
| CSS                                                | 51.2 MB in 632 files, 251 distinct                |
| Ownership marker                                   | 2.27 MB, 1.89 MB compact, 77,208 nodes            |
| Current-only build                                 | 12 min 54 s, 4.64 GB peak RSS                     |
| Pull-request build against `HEAD~1`                | 2,580.5 MB in 26,070 files                        |
| Its comparison generation                          | 823.5 MB in 15,040 files, with 0 comparable views |
| Its distinct files                                 | 2,049.6 MB in 13,753 files                        |
| Its marker                                         | 6.19 MB compact, 182,488 nodes                    |
| Its build, with 2 sidecars                         | 56 min 2 s, 5.27 GB peak RSS                      |

The detail shapes of the design calls below, as compact JSON:

| Detail shape                                                  |     Size |
| ------------------------------------------------------------- | -------: |
| Today                                                         | 414.2 MB |
| Each distinct props value once in each detail                 | 344.1 MB |
| And a view that equals an earlier view names it               | 231.5 MB |
| And `usedBy` holds one row for each consumer                  | 157.1 MB |
| And no instance `source`                                      | 144.1 MB |
| And the controls, prop schemas and props that leave the index | 162.0 MB |

A props table for the whole catalogue, instead of one in each detail, saves about 42 MB more.

After the recommended Mokly milestones, the current-only output of conductive is about 615.8 MB as declared and 559.2 MB as distinct files. The HTML is 395.7 MB of that. So each entry costs about 0.36 MB as declared, 0.33 MB as distinct files, 6.4 files and 88 index nodes. Under option C of item 5, a pull request that changes every view adds the before side: about 0.24 MB and 4.4 files for each entry.

Corrections to the brief of this workspace:

- The largest detail is `components/common/icon-button.json`, 16.8 MB, mostly 44,206 `usedBy` links. The two marketing details are 10.8 MB each, not 9.9 MB.
- The index is also above the receiver's JSON node quota. Tables for controls and prop schemas still leave 393,285 nodes. The index must lose these fields, or the quota must rise.
- When those fields move into the details, the details grow by about 18 MB. The projection of about 495 MB kept them in the index.
- Compact JSON needs no new format number. The format rule raises a number only for a change of shape or meaning, and every reader ignores whitespace.
- The exchange already uploads only changed files. The Plan answer lists only the blobs that the project lacks. The quota counts every declared file.
- After rendering, most of the build time is a second render pass. The bounded-memory workspace found that 5,898 of 6,884 views render again on one sidecar, about 440 s of an 831 s build.
- The measurement of the brief used `--no-changes`. The cloud builds each pull request with `--base`. A pull-request build against the parent commit wrote 2,580.5 MB in 26,070 files. Its comparison generation held 15,040 files, although no view was comparable. The CLI refuses more than 20,000 files, so this build cannot publish at all, at any quota.

## Terms

- **Declared bytes:** the sum of the sizes in the ownership marker `.mokly-export-artifact`, one size for each output file. The receiver limits this sum.
- **Current-only build:** a build with `--no-changes`. The cloud builds each push to the default branch this way.
- **Pull-request build:** a build with `--base`, which adds a comparison generation. The cloud builds each pull request this way.
- **Comparison generation:** the directory `mokly-viewer/diffs/generations/{generation}/`. It holds the snapshot documents of the before side and the after side.
- **Comparable entry:** a current screen or component that the viewer can compare. An index view or the entry detail marks it eligible.
- **JSON node:** a value, a container or an object key. The receiver counts the nodes of each JSON file that it parses.
- **Release window:** the time between two npm releases of `@mokly/mokly`. A format takes at most one new number in it.
- **Usage record:** the `usage` of one view in an entry detail, with its component instances, slots and ranges.

## Plan-Wide Assumptions

Every item shares these assumptions, unless an item names an option that drops one.

1. Each project publishes one catalogue. Source: the cloud keys a publication by project, head and config path in `docs/protocol/cloud/publication-upload.md`. Option D of item 1 drops it, because conductive then publishes several catalogues.
2. The static output stays complete, and its host runs nothing. Source: `docs/protocol/mokly-export-delivery.md`, Hosting Contract. Every option keeps it.
3. Each view keeps its own document. Source: the renderer receives the colour scheme under `docs/protocol/mokly-rendering.md`, and the measurement shows 0 equal pairs. Every option keeps it.
4. A format number changes only with a change of shape or meaning, and at most once in a release window. Source: `docs/protocol/mokly-format-versions.md`. Every option keeps it.
5. A format change replaces every reader of the old format in the same change, and the cloud converts no stored publication. Source: `docs/protocol/cloud/mokly-artifact-compatibility.md`, Mokly Changes. Every option keeps it.
6. The receiver quotas stay as they are. Source: the requirements of `docs/protocol/cloud/publication-upload-validation.md:20-42`, and `crates/mkc-mokly-contract/src/limits.rs:33-48`. Their reason is gone: they came from an API whose memory grew with the whole export, as `plans/follow-ups/upload-quotas-not-revisited.md` records. Options B, C and E of item 1 drop it.
7. Every build publishes every view of each entry, four for each conductive entry. Source: `docs/protocol/mokly-component-usage-records.md`, Validation. Option D of item 1 drops it.
8. A publication that is above one limit fails as a whole. Source: `docs/protocol/mokly-upload-validation.md`, Rejections, and `crates/mokly-publish/src/snapshot.rs:77-84`. Option F of item 5 drops it for the comparison.

## Decisions

Implementation starts only after the user answers items 1 to 8. Answer each item by its number and letter.

| #   | Item                                             | Source | Severity | Effort | Recommended                                              |
| --- | ------------------------------------------------ | ------ | -------- | ------ | -------------------------------------------------------- |
| 1   | A large catalogue cannot publish                 | Design | High     | Large  | C: Mokly writes less, and the cloud resizes its quotas   |
| 2   | No size target for one publication               | Design | High     | Medium | B: about 3,500 entries for every build                   |
| 3   | The receiver counts copies and caps growth       | Design | High     | Medium | C: count each file once, and set ceilings for the target |
| 4   | The index carries each entry's controls          | Design | High     | Large  | B: each detail carries its own                           |
| 5   | Pull-request builds copy every document twice    | Design | High     | Large  | C: snapshots of comparable views only, and no after side |
| 6   | A format change breaks the cloud until a release | Design | Medium   | Small  | B: two pull requests                                     |
| 7   | No build time target                             | Design | Medium   | Small  | A: no target, and measure only                           |
| 8   | Compact JSON changes every detail id             | Design | Low      | Small  | A: the ids hash the compact bytes                        |

### 1. A large catalogue cannot publish

- **Severity:** High. **Likelihood:** Common. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mkc-mokly-contract/src/bundle_validation.rs:29-37`, `crates/mkc-mokly-contract/src/json_guard.rs:16`, `crates/mokly-model/src/canonical.rs:42-57` and `crates/mokly-static/src/comparison_files.rs:32-68`.
- **Background:** `mokly publish` builds the static output, and it uploads each file that the project lacks. The receiver checks the declared catalogue before any file arrives. It accepts 512 MiB of declared bytes, 19,999 marker entries, an 8 MiB index and 262,144 JSON nodes in the index. The CLI refuses more than 20,000 files before any request.
- **Problem:** Conductive is above four of these limits. Its declared bytes are 1,746 MB. Its index is 48.7 MB with 2,162,642 nodes. Its pull-request build has 26,070 files and 2,580.5 MB.
- **Impact if no action:** Conductive never publishes. Each other large catalogue meets the same limits.
- **Root question:** How does a large and growing catalogue publish within the cloud's limits?
- **Shared assumptions:** The plan-wide assumptions. Option D drops assumptions 1 and 7. Option F of item 5 drops assumption 8 for the comparison.
- **Options:**
  - **A.** Mokly writes less, and the quotas stay. This needs every Mokly milestone of this plan, a props table for the whole catalogue and the HTML work of the design calls. Conductive's current-only build then lands near 431 MB. It fails again near 2,150 entries, and a pull request that changes every view still fails. Effort: Large.
  - **B.** Mokly takes only compact JSON, and the cloud changes its quotas. The cloud counts each stored file once, and it raises each ceiling until conductive fits. The viewer still fetches a 20.8 MB index at each page load, and each build still writes about 0.89 GB. Effort: Medium.
  - **C.** Both. Mokly writes less where the viewer and the build gain. The cloud counts each stored file once, and it sizes its quotas for the target of item 2. Effort: Large.
  - **D.** Conductive splits its catalogue into several configurations, or it renders fewer views. Mokly does not change. One catalogue becomes several, and the limits fail again as each part grows. Effort: Medium.
  - **E.** C, and the index splits into a navigation index and one record file for each folder. The navigation index keeps the tree and each record's path, title, kind, tags, Changes, detail id and variant parent. On conductive it is 0.56 MB with 39,932 nodes, 23 for each entry, so it stays under 262,144 nodes up to about 11,000 entries. It changes the index format, the viewer's loading and the receiver's index reader. The options check of 2026-11-27 added it. Effort: Large.
- **Left out:**
  - Compress only the upload. The quotas count decoded bytes.
  - One document for both colour schemes. The renderer writes different inline colours for each scheme, and 0 of 3,442 pairs are equal after the scheme marker.
  - The viewer computes `usedBy` itself. It needs every detail, 414 MB as compact JSON.
  - Data from a server at view time. The static host runs nothing, under assumption 2.
  - Upload only the changed files. The exchange already does it, and the quotas count the whole declared catalogue.
  - A size warning in `mokly build`. A receiver can set quotas below the Mokly ceilings, and the CLI does not know them.
- **Wider fix:** C. It removes the copies at their source, and it gives the quotas room for growth.
- **Previous examples:** Item 1 of the workspace "conductivity build issue" on 2026-11-27. The items `plans/follow-ups/compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md` and `upload-quotas-not-revisited.md` hold parts of the same problem.
- **Related:** Items 2 to 5, work that waits for the answer. Item 3 applies only under B, C and E. Option E also answers item 4.
- **Recommendation:** C. The Mokly changes make the index and the details fast to load and to build, and only a quota change leaves room for growth. E matters only under option C of item 2, or when growth is faster.
- **Action:** ask the user, because A, B, C and E change requirements in force, and D moves the work to conductive.

### 2. No size target for one publication

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `docs/protocol/cloud/publication-upload-validation.md:20-36`.
- **Background:** Each limit binds at a different catalogue size. After the recommended Mokly milestones, a conductive entry costs about 0.33 MB, 6.4 files and 88 index nodes in a current-only build. Under option C of item 5, a pull request that changes every view adds about 0.24 MB and 4.4 files for each entry. Conductive has 1,721 entries. It grew from 72 to 664 entry files in 19 days, so it doubled about every six days.
- **Problem:** The plan cannot size the quotas, or decide the optional work, without a target.
- **Impact if no action:** The limits fail again soon after the change, or the cloud accepts much more than it needs.
- **Root question:** How large a catalogue must one publication hold, and for which builds?
- **Shared assumptions:** A target in entries becomes ceilings through conductive's cost for each entry. That holds only for catalogues like conductive, with four views for each entry and few public files. Option D drops it. One target serves every project. Option E of item 3 drops it.
- **Options:**
  - **A.** Conductive today with 25% room: about 2,150 entries, for current-only builds and pull requests that change few views. It needs a byte ceiling near 1 GiB of distinct files. A pull request that changes a widely used component can still fail. Effort: Small.
  - **B.** Twice conductive today: about 3,500 entries for every build, also a pull request that changes every view. It needs the ceilings of option C of item 3. Effort: Medium.
  - **C.** About 10,000 entries for every build. It needs ceilings about three times those of B. The index of such a catalogue is about 17 MB, and every page load fetches it. Effort: Large.
  - **D.** No catalogue size. Measure the API memory, the ingest time and the database rows with a synthetic upload. Set each ceiling 25% below the measured safe bound, and report the entry count that fits. The ceilings can then be far above any real need, so one upload can use a lot of storage. The options check of 2026-11-27 added it. Effort: Medium.
- **Left out:** None. The options check of 2026-11-27 brought back the approach without a target as D.
- **Wider fix:** None. A target is a policy, not a fix.
- **Previous examples:** Option B of `plans/follow-ups/upload-quotas-not-revisited.md` proposed the measurement of D.
- **Related:** Item 3 takes its ceilings from this answer. Item 5 needs option C or a later option under B or C here.
- **Recommendation:** B. A 3,500-entry index stays near 5.8 MB, below the 8 MiB quota, and B covers a pull request that changes every view. At the growth rate of November, twice today lasts about a week, so the user's view of growth decides between B and C.
- **Action:** ask the user, because the user asked for this choice, and the right size depends on growth that only the user can judge.

### 3. The receiver counts copies and caps growth

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mkc-mokly-contract/src/bundle_validation.rs:29-37`, `crates/mkc-mokly-contract/src/limits.rs:18-48`, `crates/mkc-mokly-contract/src/json_guard.rs:16-18` and `crates/mokly-model/src/output/validation.rs:15`.
- **Background:**
  - The receiver adds the size of every marker entry, also of a repeated file. Blob storage is per project and per digest, so a repeated file costs no storage. Source: `docs/protocol/cloud/persistence-publication-storage.md`.
  - The declared-bytes check reuses the plan-archive quota, `limits.decompressed()`, so one number serves both quotas today.
  - The 20,000-file ceiling is a Mokly protocol limit. `mokly publish` checks it before any request.
  - The marker and the index must each stay under 262,144 JSON nodes. A marker entry takes 7 nodes, so the marker reaches the quota near 37,400 files.
  - The 48 MiB marker quota covers 19,999 entries with the longest path. A 64 MiB file holds only about 31,000 such entries.
  - API memory no longer grows with the file bytes. Its headroom still covers at most 20,000 path and index records, as `docs/ops/environment.md`, API Upload Memory Sizing, says.
- **Problem:** After the recommended Mokly milestones, conductive's current-only output is about 615.8 MB as declared and 559.2 MB as distinct files. Both are above 512 MiB. A pull request that changes every view adds about 412 MB and 7,520 files, which gives about 1,028 MB and 18,550 files.
- **Impact if no action:** Conductive cannot publish after the Mokly milestones, unless Mokly also takes the HTML work of option A of item 1.
- **Root question:** Which limits must a publication meet, so that the target fits and the cloud stays protected?
- **Shared assumptions:** One set of quotas serves every project. Option E drops it. The receiver checks each quota at Plan time, from the declared decoded sizes, so that it refuses before any Blob. Option D must change this.
- **Options:**
  - **A.** Keep every quota and ceiling. It needs option A of item 1. Effort: Large.
  - **B.** Count each distinct file once, and keep the ceilings. The declared-bytes quota gets its own number, apart from the plan-archive quota. Conductive is still about 4% above 512 MiB. Effort: Small.
  - **C.** B, and set each ceiling for the target of item 2 with 25% room. For option B of item 2, the ceilings are 2.5 GiB of distinct bytes, 50,000 files and an 8 MiB index. The marker and the index each get 524,288 JSON nodes. The CLI file ceiling changes too. The marker quota and the record headroom grow for 50,000 files, and a marker with very long paths then holds fewer files. Measure the API memory, the record count and the ingest at the new bounds. Effort: Medium.
  - **D.** Count the gzip size of each distinct file, and store and serve gzip blobs. Today's conductive output is 188.6 MB this way. The marker declares only decoded sizes, so D also needs encoded sizes in the marker, or a check after the Blobs. It does not change the file or the index limits. Effort: Large.
  - **E.** A Team workspace gets the ceilings of C, and a free workspace keeps today's quotas. The receiver already gates an upload on the workspace plan, under `docs/protocol/cloud/billing-plan-gates.md`. It is a pricing choice, an environment without billing needs a default, and a refused free upload needs product copy. The options check of 2026-11-27 added it. Effort: Large.
- **Left out:**
  - Count only the bytes that one upload adds. The first publication of a project adds every byte, so a ceiling for the whole catalogue stays.
  - Remove the quotas. A bound keeps one upload from using up storage and time.
  - Count each distinct file once in the file limit. Each path costs a database row and a marker entry, whatever its digest.
- **Wider fix:** C. Each ceiling then follows a stated target, and duplicates never count.
- **Previous examples:** `plans/follow-ups/upload-quotas-not-revisited.md` asked to measure the quotas, and no measurement exists.
- **Related:** Item 1: this item applies only under B, C or E there. Item 2 gives the target. Item 4, option D, needs higher index quotas here.
- **Recommendation:** C. It counts what the cloud stores, and each ceiling has a reason that a later change can check.
- **Action:** ask the user, because each option except A changes the quotas of `docs/protocol/cloud/publication-upload-validation.md` or the ceilings of `docs/protocol/mokly-upload-validation.md`.

### 4. The index carries each entry's controls

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-model/src/projection_records.rs:47-71`, `crates/mokly-model/src/usage_schemas.rs:22-36` and `packages/viewer/src/shell/control_values.ts:196-227`.
- **Background:** Each screen and component record of the index carries `propSchema`, `props` and `controls`. The viewer reads them for the Props panel of the shown entry. It also reads a component's `props` beside the detail's `before` props in a comparison, in `packages/viewer/src/shell/public_compared.ts:42-44`. The detail already carries `controlOrder`. Conductive's 957 screens use 33 distinct control sets. The Rust usage check reads the component schemas from the index. A decision in force in `docs/protocol/mokly-shell-delivery.md:42-44` chose compression over a smaller index format, because compression keeps every canonical byte and every read of the viewer.
- **Problem:** These three fields are about 18 MB of the 20.8 MB compact index, and 2,011,954 of its 2,162,642 nodes. Each page load fetches and parses them.
- **Impact if no action:** The receiver refuses the index, and every page load of a large catalogue is slow.
- **Root question:** Where do the prop schema, the saved props and the controls of an entry live, so that page loads stay small and the receiver accepts the index?
- **Shared assumptions:** The viewer fetches and parses the whole index at each page load, under `docs/protocol/mokly-export-delivery.md`. Option E of item 1 drops it. The decision for compression over a smaller index does not cover the node quota or the parse time. Options A, B and C reverse that decision, and D keeps it.
- **Options:**
  - **A.** Tables in the index hold each distinct control set and prop schema once. The index is 4.7 MB with 393,285 nodes. It is already above the quota of 262,144 nodes, and at 3,500 entries it needs about 549,000. Effort: Medium.
  - **B.** Each entry's detail carries its own prop schema, saved props and controls. The index is 2.85 MB with 150,688 nodes, 88 for each entry. The details grow by about 18 MB, because screens repeat their shared schema. The usage check reads component schemas from the component details. Effort: Large.
  - **C.** B, but one shared file holds each distinct prop schema and control set by digest. The details grow by about 1.3 MB, and the shared file is about 0.6 MB. The viewer fetches one more file before it shows controls. Effort: Large.
  - **D.** Keep the index, and raise the index quotas to 32 MiB and 4,194,304 nodes. Each page load then fetches 20.8 MB, 4.4 MB with gzip, and parses it. Effort: Small.
- **Left out:**
  - Omit only the copies on variants, option B of `plans/follow-ups/variant-prop-schema-copies.md`. These copies are 10.07 MB and 1,114,589 nodes, but the index then keeps about 1,048,000 nodes, four times the quota. So it fails the goal.
  - Each reader derives the controls from the prop schema. The sidecar adds Storybook `argTypes` to the derived controls, so the read model must carry the result.
- **Wider fix:** B. No entry field then grows the index.
- **Previous examples:** `plans/follow-ups/variant-prop-schema-copies.md`. PR #223 kept a component's usage lists only in its parent detail.
- **Related:** Item 1: option E also splits the index. Item 3: option D needs higher index quotas there. Item 6: A, B and C need index version 10 and entry detail version 5.
- **Recommendation:** B. The index keeps only what navigation needs, and each detail stays complete for the entry that it serves.
- **Action:** ask the user, because each option changes the index format, the detail format or the receiver quotas, and A, B and C reverse a decision in force.

### 5. Pull-request builds copy every document twice

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-static/src/comparison_files.rs:32-68`, `crates/mokly-static/src/comparison_output.rs:24-83` and `docs/protocol/mokly-comparison-panes.md:28-56`.
- **Background:** A pull-request build writes a comparison generation. It copies every document, resource and public file of each side under `snapshots/before/` and `snapshots/after/`. The viewer fetches a snapshot only for a comparable view and for a removed entry. An after document is the current document without the frame probe. The viewer reads a pane document with scripts disabled. Mokly Cloud serves each publication at its own host with its exact stored bytes.
- **Problem:** A pull-request build of conductive against its parent commit wrote 26,070 files and 2,580.5 MB. Its generation held 7,520 before files and 7,520 after files, 823.5 MB, although no view was comparable. The CLI refuses more than 20,000 files before any request.
- **Impact if no action:** Conductive's pull requests never publish, so its GitHub check never runs.
- **Root question:** How does a pull-request publication of a large catalogue fit the upload limits, so that its check runs and its comparisons load? The options check of 2026-11-27 replaced the first question, which named snapshot files.
- **Shared assumptions:** A publication that is above one limit fails as a whole. Option F drops it. The output holds each pane document under the generation. B narrows it, C and G drop it for the after side, and D drops it. Snapshot bytes are the composed documents. E drops it.
- **Options:**
  - **A.** Keep both full sides. Effort: Small.
  - **B.** Write snapshots only for the views of comparable entries, for removed entries, and for each document that a kept document embeds. This is option B of `plans/follow-ups/unread-comparison-snapshots.md`. A pull request that changes every view still writes both sides. Effort: Medium.
  - **C.** B, and the after pane of a static build reads the current document, so the build writes no after side. Serve keeps its captured after side. A generic static host needs the deployment fence, because current documents change with each deployment. Effort: Large.
  - **D.** The cloud builds a large pull request current-only. Its check and its viewer then show no Changes. Effort: Small.
  - **E.** A static build keeps the frame probe in each snapshot document. An after snapshot then equals its current document, and an unchanged before snapshot has the same bytes. The distinct count of item 3 and the blob store keep each such file once. The file count still doubles. The options check of 2026-11-27 added it. Effort: Medium.
  - **F.** When a comparison would be above a ceiling that the CLI checks, the build drops the pane documents, publishes, and warns. The index and the details keep Changes, so the check runs, and the viewer shows each comparison as unavailable. It needs a format field, a viewer state with its copy, and a byte ceiling that the CLI knows. The options check of 2026-11-27 added it. Effort: Large.
  - **G.** C, and the rule that the user chose on 2026-10-27: the build writes no before document that equals its after document, and the before pane reads the current document. The five open decisions of `plans/follow-ups/skip-equal-before-snapshots.md` come with it. The options check of 2026-11-27 brought it back. Effort: Large.
- **Left out:**
  - A before pane that reads the base commit's own publication. The output must stay complete, and a merge base can have no publication.
  - A snapshot store by content inside the output. The viewer cannot rewrite addresses inside stylesheets, and the receiver already stores each digest once.
- **Wider fix:** F, changed from C by the options check of 2026-11-27. Under C the before side still copies each unchanged resource, and C fails again when a pull request is above the new ceilings. F prevents that failure for any limit.
- **Previous examples:** `plans/follow-ups/unread-comparison-snapshots.md`, `skip-equal-before-snapshots.md` and `snapshot-resource-copies.md`. When a base fails validation, the CLI already publishes without a comparison, under `docs/protocol/cloud/cloud-build-runner.md`.
- **Related:** Item 2: its options B and C need C or a later option here. Item 3: E relies on its distinct count. Item 6: C adds an index field for the after source.
- **Recommendation:** C. A pull request that changes every view then adds one copy of each document, not two. F protects the codebase best, because a pull request above any ceiling still publishes its check.
- **Action:** ask the user, because B, C, E and G change the generation rules of `docs/protocol/mokly-changes-serving.md`, `mokly-export-delivery.md` and `mokly-comparison-panes.md`, and F adds a viewer state.

### 6. A format change breaks the cloud until a release

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `crates/mkc-mokly-contract/src/index.rs:30-37`, `crates/mkc-build-sandbox/src/versions.rs:6` and `docs/ops/mokly-release-cutover.md`.
- **Background:** Each push to `main` deploys the cloud with the workspace packages. The receiver accepts one index number, and the app's viewer reads one detail number. Customers and the cloud build runner publish with released CLIs. The runner uses the CLI that each repository installs, or the newest release. Compact JSON and the quota changes need no new format number.
- **Problem:** From the merge of index version 10, the receiver refuses each released CLI that writes index version 9 with HTTP 426. Each project fails until it upgrades its own CLI to a release that writes index version 10.
- **Impact if no action:** Every cloud publication fails in that window, and each separate format release adds another window and another cutover.
- **Root question:** How do the format changes reach the cloud and each project with a released CLI, so that publications fail for the shortest time? The options check of 2026-11-27 replaced the first question, because the refusal lasts until each project upgrades, not only until the release.
- **Options:**
  - **A.** One branch and one pull request for every milestone, then a release. Compact JSON and the quotas wait for the format work. Effort: Small.
  - **B.** Two pull requests. The first carries the documentation, compact JSON and the quotas. The second carries every format change, and a release follows it. Effort: Small.
  - **C.** One pull request for each milestone, and no release until the last format change merges. The cloud refuses released CLIs from the first format merge to that release. Effort: Medium.
  - **D.** One pull request and one release for each format change. Each takes its own index number and its own cutover. Effort: Large.
- **Left out:**
  - A receiver that reads index 9 and index 10 for a time. The artifact compatibility decision rejects two format families, under assumption 5.
  - A prerelease that a project pins before the merge. The release docs name only the `latest` dist-tag, and conductive cannot publish before the format change in any case.
- **Wider fix:** None. The grouping is a process choice.
- **Previous examples:** Release 0.18.0 shipped index version 9 and entry detail version 4 together, from PR #224.
- **Related:** Items 4 and 5 hold the format changes.
- **Recommendation:** B. Compact JSON and the quotas help every catalogue at once, and the format changes need one cutover. The first pull request alone does not let conductive publish, because its compact index is still 20.8 MB with 2,162,642 nodes.
- **Action:** ask the user, because the options trade early savings against review size and the length of the refusal window, and no option is clearly best.

### 7. No build time target

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-static/src/assembly.rs:101-110`.
- **Background:**
  - The current-only build of conductive took 12 min 54 s here, with a 4.64 GB peak.
  - The bounded-memory workspace found that 5,898 of 6,884 views render a second time, on one sidecar. That pass takes about 440 s of an 831 s build.
  - A smaller output also lowers the peak memory, because `build` keeps every output file in memory until it installs the output.
  - The template branch `calummoore/build-capacity-bigger-template-and-j7o5` raises the template to 8 vCPU and 16 GiB, and the attempt deadline to 30 minutes.
  - A pull-request build also renders the base side, and it can install the base dependencies within the deadline.
- **Problem:** The brief asks whether this plan sets a time target, and the time depends mostly on work outside this plan.
- **Impact if no action:** Nobody knows whether a large build fits the attempt deadline after both workspaces finish.
- **Root question:** How long may a cloud build of a large catalogue take, and which work keeps it within that time? The options check of 2026-11-27 replaced the first question, which asked about this plan, not about the build.
- **Options:**
  - **A.** No time target. Milestone 8 records the time and the peak memory of both builds, before and after. Effort: Small.
  - **B.** A target: a conductive pull-request build within the 30-minute attempt deadline on the bigger template. It makes the disk-backed capture of the bounded-memory workspace a dependency of this plan. Effort: Medium.
- **Left out:**
  - This plan removes the second render pass itself. The bounded-memory workspace owns that work as its item 2, and the brief forbids repeated work.
  - A render store in `build` and `publish`. A decision in force in `docs/protocol/mokly-render-store.md` rejects it, because uploads would keep stored results of unsupported inputs.
  - Fewer than three approaches are real, because the work that sets the time belongs to two other workspaces.
- **Wider fix:** None. The render pass belongs to the other workspace.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** A. The time depends on the other workspaces, and this plan can measure it without owning it.
- **Action:** ask the user, because the user asked for this choice.

### 8. Compact JSON changes every detail id

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-model/src/canonical.rs:87-117` and `docs/protocol/mokly-catalogue-serialization.md`, Detail Identity.
- **Background:** A detail id is the SHA-256 of the detail's canonical JSON, with its id and its revision zeroed. The deployment id hashes the output. No reader computes a detail id again, so released CLIs keep publishing after the change. The project is not in production.
- **Problem:** Every catalogue gets new detail ids and a new deployment id one time. The first publication after the change uploads every detail again. An open tab reloads at its next detail request, because the deployment id changes.
- **Impact if no action:** None beyond that one time.
- **Root question:** Does each catalogue accept new detail ids one time, when its JSON files become compact? The options check of 2026-11-27 replaced the first question, which named the hash input.
- **Options:**
  - **A.** The ids hash the compact bytes. Every id changes one time. Effort: Small.
  - **B.** The ids keep hashing the two-space form, while the files are compact. The ids stay, but the file digests and the deployment id still change. So the upload and the reload are the same, and a second encoder stays. Effort: Small.
- **Left out:** Fewer than three approaches are real, because no other encoding gains anything. The file bytes and the deployment id change under every option. An id over the parsed tokens is not better than A on any point.
- **Wider fix:** None. Option A keeps one canonical encoding.
- **Previous examples:** PR #224 changed every detail id one time, when details got content ids.
- **Related:** None.
- **Recommendation:** A. B saves nothing, because the upload and the reload are the same under both options.
- **Action:** ask the user, because the user asked to confirm the one-time change of the ids.

## Design Calls

Each call is mine, made on 2026-11-27 under the decision test. Each one holds under the recommended answers.

- Compact JSON takes no new format number. Reason: the format rule raises a number only for a change of shape or meaning, and every reader ignores whitespace.
- One canonical form serves every JSON file of the output. These files are the index, the details, the generation details, the removed previews, the deployment file, the marker and the upload manifest. Reason: one encoder. Today the marker and the manifest use pretty output at `crates/mokly-model/src/output/artifact.rs:64` and `crates/mokly-model/src/output/upload.rs:128`.
- Compact JSON changes no key and no HTML byte. Reason: `propsKey`, instance keys and slot keys hash compact `serde_json` bytes in `crates/mokly-model/src/material.rs:19-42`.
- Each detail stores each distinct props value once, in a table keyed by `propsKey`, and each instance keeps only its `propsKey`. Reason: each detail stays complete, and the decision of 2026-11-27 covers "bound or deduplicate the usage records". A table for the whole catalogue saves about 42 MB more, but it adds a shared file and a fetch.
- A view whose usage record equals an earlier view of the same detail names that view instead of a copy. Reason: 781 of 1,721 entries have four equal views, and the change saves 112.6 MB.
- `usedBy` and `affected` hold one row for each consumer. A row gives the entry path, the kind, the title, `removed`, `comparisonEligible` and `direct`. It also gives the instance count, the view count, and the first link's viewport, scheme and instance key. Reason: the viewer shows these rows in `packages/viewer/src/shell/workspace_usage.tsx:68-122`. A row keeps its title, because a removed consumer's title can be absent from the current index. One row for each instance costs 22 MB more.
- The detail omits the instance `source`. Reason: no reader of a detail uses it, and the core only validates it in `crates/mokly-model/src/usage_context.rs:76-81`. It saves 13 MB after the other steps.
- A detail format change ships in the same release window as the index change. Reason: the receiver gates only the index number. Without an index change, a detail from an older CLI reaches the app's viewer, which reads only the new number.
- The format milestones start after the bounded-memory pull request merges into `main`. Reason: both change `CatalogueAssembler`, the detail spool and `Inventory`. Compact JSON can merge before or after that pull request, because it changes only the encoder and the fixtures.
- The Mokly-owned HTML bytes stay out of this plan under the recommended answers. These are the marker `path` and `props` attributes, 34.2 MB, the frame probe templates, 32.6 MB, and the copies of collected style blocks, 43.2 MB. Reason: option C of item 3 gives the target its room without them. Under option A of item 1 they become a milestone. Inline SVG stays the consumer's markup.
- Verification uses the workspace CLI against a local receiver before the merge, and the hosted cloud after the release. Reason: a released CLI does not exist until after the merge.

## Replaced Ways

Each milestone also searches for every other consumer of its old way, and it moves that consumer.

- Two-space canonical JSON → compact canonical JSON. Moved and deleted in Milestone 2. Consumers:
  - `crates/mokly-model/src/canonical.rs`, the marker writer in `output/artifact.rs` and the manifest writer in `output/upload.rs`.
  - The byte-level tests of `mokly-model`, `mokly-static`, `mokly-server` and `mokly-compare`.
  - The cloud contract fixtures under `crates/mkc-mokly-contract/fixtures/`.
  - `docs/protocol/mokly-catalogue-serialization.md`.
- Declared bytes over every file → over each distinct digest. Moved and deleted in Milestone 3. Consumers:
  - `crates/mkc-mokly-contract/src/bundle_validation.rs` and `limits.rs`.
  - The test receiver under `tests/helpers/receiver/`.
  - `docs/protocol/cloud/publication-upload-validation.md`.
- Index records carry `propSchema`, `props` and `controls` → the detail carries them. Moved and deleted in Milestone 5. Consumers:
  - `crates/mokly-model/src/projection_records.rs`, the public index types and readers, `usage_schemas.rs` and `detail_context.rs`.
  - The base projections of `mokly-compare`.
  - The viewer's `control_values.ts`, `component_controls.tsx`, `component_controls_panel.tsx`, `component_control_fields.tsx`, `component_controls_state.ts`, `workspace_props.tsx` and `public_compared.ts`.
  - The reader fixtures under `docs/protocol/fixtures/`, and the generated types.
- Inline instance `props` → one props table in each detail. Moved and deleted in Milestone 6. Consumers:
  - The build's `crates/mokly-static/src/assembly.rs:121`, and Serve's `crates/mokly-server/src/evidence.rs` and `replacement.rs`.
  - `crates/mokly-model/src/usage_context.rs`.
  - The viewer's `control_values.ts`, `component_controls_panel.tsx`, `selection_details.ts`, `workspace_props.tsx` and `component_controls_state.ts`.
- One usage record for each view → a view can name an earlier view's record. Moved and deleted in Milestone 6. Consumers:
  - The same build and Serve writers, `usage_context.rs` and `detail_validation.rs`.
  - Each viewer reader of `view.usage`, and `packages/frame/src/adapters/frame_usage.ts`.
- One `usedBy` or `affected` link for each instance and view → one row for each consumer. Moved and deleted in Milestone 6. Consumers:
  - `crates/mokly-model/src/projection_usage.rs` and Serve's `crates/mokly-server/src/changes_detail.rs`.
  - `crates/mokly-compare/src/projection_workspace.rs`, `projection_removed.rs` and `detail_validation.rs`.
  - The viewer's `workspace_usage.tsx`, `workspace_panel.tsx`, `public_workspace.ts` and `workspace_data.ts`.
- After snapshots of a static build → current documents for the after pane. Moved and deleted in Milestone 7. Consumers:
  - `crates/mokly-static/src/comparison_files.rs` and `comparison_output.rs`.
  - The viewer's pane loader, and the browser specs of comparisons.
- Snapshots of every view → snapshots of the views of comparable entries. Moved and deleted in Milestone 7. Consumers: the same files.

## Implementation Order

Under the recommended answers, the work reaches `main` in two pull requests, as item 6 proposes.

- The first pull request is the one of this plan. It carries Milestones 1 to 4. Milestones 2 and 3 can run in parallel workspaces after Milestone 1, because they change different crates. If Milestone 3 changes a contract fixture, it merges after Milestone 2.
- The second pull request starts from `main` after the first one merges, and after the bounded-memory pull request merges. Milestones 5, 6 and 7 run one after the other, because each changes the detail type and the fixtures. Milestones 8 and 9 close it.

Other answers change the plan before any milestone starts:

- Option A of item 1: before Milestone 8, add a milestone for the HTML work and the catalogue-wide props table. Delete Milestone 3.
- Option B of item 1: delete Milestones 5, 6 and 7, and size the quotas for the output as it is.
- Option D of item 1: delete every milestone except 1, and write the guidance for consumers.
- Option D of item 4: delete Milestone 5, and raise the index quotas in Milestone 3.
- Option A or D of item 5: delete Milestone 7. Under D, add the large-build rule to the cloud build runner.
- Option A, C or D of item 6: regroup the milestones into the chosen pull requests.
- Option E of item 1: add a milestone that splits the index, directly after Milestone 5.
- Option D of item 2: Milestone 3 measures the receiver first, and then it sets the ceilings.
- Option D or E of item 3: Milestone 3 also changes the marker or reads the workspace plan.
- Option E, F or G of item 5: rewrite Milestone 7 for the chosen option before it starts.

## Milestone 1: Documentation and protocol

Depends on: none

Write the chosen requirements before any code changes. Each page whose behaviour waits gets a status line that links the milestone heading that builds it.

- [ ] Read the `documentation` skill.
- [ ] State the compact canonical form and the detail id of item 8 in `docs/protocol/mokly-catalogue-serialization.md`.
- [ ] State the counting rule and the ceilings of item 3 in `docs/protocol/cloud/publication-upload-validation.md` and `docs/protocol/mokly-upload-validation.md`. Update the memory budget of `docs/ops/environment.md`.
- [ ] Add the HTTP 426 row for an unsupported index version to `docs/protocol/mokly-upload-validation.md`, as option D of `plans/follow-ups/upload-plan-index-version-status.md` says. Delete that item.
- [ ] State index version 10 and entry detail version 5 in `docs/protocol/mokly-format-versions.md` and `docs/protocol/cloud/mokly-artifact-compatibility.md`.
- [ ] Replace the decision in force of `docs/protocol/mokly-shell-delivery.md:42-44`, which chose compression over a smaller index format. Give the answer to item 4 and its reason.
- [ ] State the index records and the detail fields of item 4 in `docs/protocol/mokly-catalogue.md` and `docs/protocol/mokly-shell-delivery.md`.
- [ ] State the props table, the shared view records, the consumer rows and the omitted `source` in `docs/protocol/mokly-component-usage-records.md` and `docs/protocol/mokly-shell-delivery.md`.
- [ ] State the snapshot rules of item 5 in `docs/protocol/mokly-changes-serving.md`, `docs/protocol/mokly-export-delivery.md` and `docs/protocol/mokly-comparison-panes.md`.
- [ ] Add the index 10 cutover to `docs/ops/mokly-release-cutover.md`.
- [ ] Update every other protocol page that names index version 9 or entry detail version 4, each with a status line. A search on 2026-11-27 found 30 pages and READMEs that name them. The READMEs and the user guides change with the code in Milestones 5 to 7.
- [ ] Update each follow-up item that names a decision or a section that this milestone changes, as the `plans` skill says. Start with `compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md`, `snapshot-resource-copies.md`, `skip-equal-before-snapshots.md` and `upload-quotas-not-revisited.md`.
- [ ] Keep each protocol doc within its cap. `docs/protocol/mokly-shell-delivery.md` has 245 of its 250 lines, so split it when it grows.
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Compact canonical JSON

Depends on: 1

Every JSON file of the output loses its indentation. No format number changes. Expected saving for conductive: about 860 MB. The details fall from 1,246.2 to 414.2 MB, the index from 48.7 to 20.8 MB, and the marker from 2.27 to 1.89 MB.

- [ ] Read the `rust` and `testing` skills.
- [ ] Encode compact JSON in `crates/mokly-model/src/canonical.rs`. Keep the key order, the number spelling and the final LF.
- [ ] Write the marker and the upload manifest in the same form.
- [ ] Hash the compact bytes for each detail id, as item 8 proposes.
- [ ] Update each test that pins pretty bytes. Add a regression test that a canonical document has no whitespace between its tokens.
- [ ] Run `cargo xtask mokly-fixtures`, and commit its output.
- [ ] Build `examples/basic` and conductive, and record their sizes under `.context/large-catalogue-publication/`.
- [ ] Delete `plans/follow-ups/compact-json-output.md`.
- [ ] Run `cargo xtask check --suite repository` and the targeted tests of the changed crates.

## Milestone 3: Receiver quotas

Depends on: 1

The receiver counts each distinct file once, and each ceiling follows the target of item 2. No file gets smaller. The counted bytes of conductive fall by 56.7 MB today, because 3,147 files repeat another file.

- [ ] Read the `rust` and `testing` skills.
- [ ] Sum the declared bytes over distinct digests in `crates/mkc-mokly-contract/src/bundle_validation.rs`.
- [ ] Give the declared-bytes quota its own number in `limits.rs`. Today the check reuses the plan-archive quota, `limits.decompressed()`.
- [ ] Size the marker quota and the record headroom of the API for the new file ceiling.
- [ ] Set the ceilings of item 3 in `crates/mkc-mokly-contract/src/limits.rs` and the JSON node budgets in `json_guard.rs`.
- [ ] Set the file ceiling in `crates/mokly-model/src/output/validation.rs`, and check that `mokly publish` applies it.
- [ ] Update the test receiver under `tests/helpers/receiver/`.
- [ ] Add a regression test for each new bound, and one that a repeated file counts once.
- [ ] Measure the API memory and the ingest time with a synthetic upload at the new bounds. Record the result under `.context/large-catalogue-publication/`.
- [ ] Delete `plans/follow-ups/upload-quotas-not-revisited.md`.

## Milestone 4: First pull request

Depends on: 1, 2 and 3

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Keep this plan, because the work spans two pull requests.
- [ ] Record a follow-up item for the problem outside the scope that the options check of 2026-11-27 found. The CLI reads no rejection body, so an HTTP 413 answer does not name the limit that failed.
- [ ] Update the description of this pull request with the decisions, the design calls and their dates.

## Milestone 5: Entry fields leave the index

Depends on: 4, and the bounded-memory pull request merged into `main`

Index version 10 and entry detail version 5 start here. Each detail of a screen or a component carries its prop schema, its saved props and its controls. Expected result for conductive: the index falls from 20.8 MB and 2,162,642 nodes to 2.85 MB and 150,688 nodes. The details grow by about 18 MB, so the total stays about the same.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Raise the numbers in `crates/mokly-model/src/versions.rs`, and run `cargo xtask generate-types`.
- [ ] Move the fields from `crates/mokly-model/src/projection_records.rs` into the detail projection.
- [ ] Read the component schemas from the component details in `usage_schemas.rs` and `detail_context.rs`. Update the strict and the lenient readers.
- [ ] Update the base projections of `mokly-compare` and each Serve route that reads the fields.
- [ ] Read the control target from the detail in the viewer, and move each viewer consumer of the old fields.
- [ ] Accept only index version 10 in `crates/mkc-mokly-contract/src/index.rs`, and update its tests and its corpus.
- [ ] Raise `MIN_MOKLY_VERSION` in `crates/mkc-build-sandbox/src/versions.rs` to the first release that writes index version 10.
- [ ] Rename and rewrite the reader fixtures under `docs/protocol/fixtures/`. Run `cargo xtask mokly-fixtures`.
- [ ] Search for every other consumer of the old fields, and move it.
- [ ] Update each README that names index version 9 or entry detail version 4.
- [ ] Measure the index of conductive: its bytes and its nodes.
- [ ] Delete `plans/follow-ups/variant-prop-schema-copies.md`.

## Milestone 6: Usage records stored once

Depends on: 5

Expected saving for conductive: about 270 MB. The details fall from about 432 to about 162 MB.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Write the props table, the shared view records, the consumer rows and the omitted `source` in the detail projection.
- [ ] Apply the same rows to `affected` and to removed entries in `crates/mokly-compare/src/projection_workspace.rs` and `projection_removed.rs`.
- [ ] Check the new shapes in `usage_context.rs`, `detail_validation.rs` and the lenient readers. Recompute each `propsKey` from its table entry.
- [ ] Give the viewer one reader for a view's usage record and one for an instance's props. Move every viewer consumer to them.
- [ ] Read the consumer rows directly in `workspace_usage.tsx` and `workspace_panel.tsx`.
- [ ] Run `cargo xtask mokly-fixtures`, and update the reader fixtures.
- [ ] Measure the details of conductive.

## Milestone 7: Snapshots only where a reader opens them

Depends on: 6

A current-only build does not change. Expected saving for conductive: a pull request without a comparable view writes none of the 15,040 snapshot files, 823.5 MB. A pull request that changes every view writes about 7,520 before files, about 412 MB, and no after files.

- [ ] Read the `rust`, `typescript`, `testing` and `deterministic-tests` skills.
- [ ] Write snapshot documents only for the views of comparable entries, for removed entries, and for each document that a kept document embeds.
- [ ] Write no after side in a static build. Add the index field that tells the viewer to read the after pane from the current document.
- [ ] Load the after pane from the current document, after the deployment fence, in the viewer. Keep Serve's captured after side.
- [ ] Run each changed browser spec of comparisons 10 times, and record the pass count.
- [ ] Delete `plans/follow-ups/unread-comparison-snapshots.md` and `snapshot-resource-copies.md`. Narrow `skip-equal-before-snapshots.md` to the equal before documents of comparable entries.
- [ ] Add the upgrade section for index version 10 and entry detail version 5 to `docs/guides/start/upgrade.md`, with the `external docs implementor` action. It covers Milestones 5 to 7.

## Milestone 8: Conductive verification

Depends on: 7

- [ ] Build conductive at `3371d05f` with the workspace CLI, current-only.
- [ ] Add a local commit that changes `components/common/icon-button`, and build with Changes against its parent, so that every view changes.
- [ ] Publish both outputs to a local receiver, as the interactive local procedure of `docs/ops/publish-smoke.md` says. Both uploads must pass.
- [ ] Record the declared and the distinct bytes, the files, the index bytes and nodes, the build time and the peak RSS. Compare them with the target of item 2.
- [ ] Open both catalogues in the viewer. Check Browse, the Props panel, Used by and each comparison mode. Save screenshots under `.context/large-catalogue-publication/`.

## Milestone 9: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Its description gives the decisions and the design calls of this plan with their dates. It also gives a permalink to this plan and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Release the format changes. The user merges the release pull request.
- [ ] Run the index 10 steps of `docs/ops/mokly-release-cutover.md` in each stable environment.
- [ ] Upgrade `@mokly/mokly` in conductive, in its own repository.
- [ ] Publish a push and a pull request of conductive through the cloud build on the bigger template, and record the result.
