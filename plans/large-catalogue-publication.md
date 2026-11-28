# Large Catalogue Publication

Status: Active, on the branch `calummoore/catalogue-size-plan-to-fit-the-upload-pjqr`. No pull request is open. The planning pull request, PR #608, closed on 2026-11-28 at the user's request, because a pull request opens only when its implementation is complete. Every decision of this plan waits for the user, and no implementation is approved. The first implementation pull request brings this plan to `main` and keeps it. The last implementation pull request deletes it, as the `plans` skill says.

Mokly Cloud refuses the catalogue of a large project. On 2026-11-27, the repository `Firna-AI/conductive` at commit `3371d05f` built with `@mokly/mokly` 0.21.0 into 1,746 MB in 11,030 files. The receiver accepts 512 MiB, about 537 MB, of declared bytes. The index was 48.7 MB with 2,162,642 JSON nodes, and the receiver accepts 8 MiB and 262,144 nodes. A pull-request build wrote 26,070 files, above the ceiling of 20,000, because it copies every document two more times. Conductive had 72 entry files on 2026-11-08 and 664 on 2026-11-27.

This plan makes two changes together, as the user chose for item 1 on 2026-11-28. Mokly writes less in four steps: compact canonical JSON, entry fields out of the index, usage records written once, and fewer snapshots. The cloud counts each stored file once, and it sizes its quotas for the answer to item 2. Every other recommendation below is a proposal of 2026-11-27 or 2026-11-28, not a choice.

The plan does not change the build template, the attempt deadline, or the memory of the native process. The workspaces "Build capacity: bigger template and deadline" and "Build capacity: bounded render memory" own them. The plan does not render both colour schemes from one document.

On 2026-11-27 the workspace "conductivity build issue" gave the user its item 1 with three options:

- A. Raise the receiver limits.
- B. Make the output smaller in Mokly, with compact JSON and bounded or deduplicated usage records.
- C. Conductive cuts its catalogue.

The user asked for a brainstorm of item 1, and then for this plan. The parent workspace read that as option B. This plan keeps the root question open as item 1, because the brainstorm found more approaches.

On 2026-11-28 the user wrote: "don't worry about conductive directly, I don't want specific changes to conductive, it should just work whatever you're setup is". So Mokly and Mokly Cloud must publish a large catalogue as it is, and no step may need a change that only one project needs. Conductive is only the measured example. The rule removes option D of item 1. It also changes the recommendations of items 2, 7, 8 and 9, and it adds options F and G to item 8.

Contract owners:

- [Catalogue serialization](../docs/protocol/mokly-catalogue-serialization.md), [format versions](../docs/protocol/mokly-format-versions.md), [shell delivery](../docs/protocol/mokly-shell-delivery.md), [catalogue](../docs/protocol/mokly-catalogue.md), [component usage records](../docs/protocol/mokly-component-usage-records.md) and [live evidence](../docs/protocol/mokly-live-evidence.md).
- [Changes serving](../docs/protocol/mokly-changes-serving.md), [export delivery](../docs/protocol/mokly-export-delivery.md), [comparison panes](../docs/protocol/mokly-comparison-panes.md) and [artifact paths](../docs/protocol/mokly-artifact-paths.md).
- [Upload validation](../docs/protocol/mokly-upload-validation.md), [upload exchange](../docs/protocol/mokly-upload-exchange.md) and [export ownership](../docs/protocol/mokly-export-ownership.md).
- The cloud pages [publication upload validation](../docs/protocol/cloud/publication-upload-validation.md), [artifact compatibility](../docs/protocol/cloud/mokly-artifact-compatibility.md), [build runner](../docs/protocol/cloud/cloud-build-runner.md), [preview capture](../docs/protocol/cloud/preview-capture.md) and [fixture regeneration](../docs/protocol/cloud/mokly-fixture-regeneration.md).
- The [model README](../crates/mokly-model/README.md), the [static README](../crates/mokly-static/README.md), the [compare README](../crates/mokly-compare/README.md), the [contract README](../crates/mkc-mokly-contract/README.md) and the [viewer README](../packages/viewer/README.md).
- The runbooks [environment](../docs/ops/environment.md), [publish smoke](../docs/ops/publish-smoke.md) and [release cutover](../docs/ops/mokly-release-cutover.md).

## Measurements

This workspace rebuilt conductive at `3371d05f` with `@mokly/mokly` 0.21.0 on 4 vCPU and 7.7 GiB. The scripts and the reports are under `.context/large-catalogue-publication/` of this workspace. Sizes are in MB of 1,000,000 bytes. Compact sizes re-encode the JSON without whitespace.

| Fact                                               | Value                                             |
| -------------------------------------------------- | ------------------------------------------------- |
| Current-only output                                | 1,746.2 MB in 11,030 files                        |
| Distinct files of that output                      | 1,689.5 MB in 7,883 files                         |
| The same files with gzip                           | 198.9 MB                                          |
| Distinct path prefixes                             | 15,520                                            |
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
| Its distinct path prefixes                         | 34,980                                            |
| Its marker                                         | 6.19 MB compact, 182,488 nodes                    |
| Its build, with 2 sidecars                         | 56 min 2 s, 5.27 GB peak RSS                      |

The detail shapes of this plan, as compact JSON:

| Detail shape                                                                  |     Size |
| ----------------------------------------------------------------------------- | -------: |
| Today                                                                         | 414.2 MB |
| A view that equals an earlier view of its detail names that view              | 235.6 MB |
| And no instance `source`                                                      | 222.7 MB |
| And one row for each consumer group in `usedBy` and `affected`, item 10 D     | 150.2 MB |
| Or every link with one table of consumers, item 10 F                          | 202.2 MB |
| The controls, prop schemas and props that leave the index add to each of them |  18.0 MB |

A props table in each detail saves only about 4.1 MB once views share their records, so the plan keeps instance props inline.

After the recommended Mokly milestones, the current-only output of conductive is about 622.0 MB as declared and 565.4 MB as distinct files. The HTML is 395.7 MB of that. So each entry costs about 0.36 MB as declared, 0.33 MB as distinct files, 6.4 files, 9.0 path prefixes and 88 index nodes. A pull-request index costs about 109 nodes and 1,844 bytes for each entry. Under option C of item 5, a pull request that changes every view adds the before side. That side costs about 0.24 MB, 4.4 files and 5.7 path prefixes for each entry. A pull request can also remove entries. Each removed entry that pairs with nothing adds an index record of about 114 nodes and 1,900 bytes, and about 6.4 files.

The next table gives each index shape of items 1 and 4. It measures the pull-request index, and it scales it to 4,375 entries, the target of option B of item 2 with 25% room.

| Index shape                                   | Measured                  | At 4,375 entries         |
| --------------------------------------------- | ------------------------- | ------------------------ |
| Today's fields, compact, item 4 D             | 21.15 MB, 2,200,238 nodes | 53.8 MB, 5,593,000 nodes |
| Tables for controls and schemas, item 4 A     | 5.00 MB, 430,881 nodes    | 12.7 MB, 1,095,000 nodes |
| No controls, schemas or props, item 4 B and C | 3.17 MB, 188,284 nodes    | 8.07 MB, 478,600 nodes   |
| Navigation index, item 1 E                    | 0.76 MB, 66,846 nodes     | 1.94 MB, 169,900 nodes   |

The index ceilings of option C of item 3 are 8 MiB, about 8.39 MB, and 524,288 nodes. The scaling is linear in the screen and component records.

Corrections to the brief of this workspace:

- The largest detail is `components/common/icon-button.json`, 16.8 MB, mostly 44,206 `usedBy` links. The two marketing details are 10.8 MB each, not 9.9 MB.
- The index is also above the receiver's JSON node quota. Tables for controls and prop schemas still leave 393,285 nodes. The index must lose these fields, or the quota must rise.
- When those fields move into the details, the details grow by about 18 MB. The projection of about 495 MB kept them in the index.
- Compact JSON needs no new format number. The format rule raises a number only for a change of shape or meaning, and every reader ignores whitespace.
- The exchange already uploads only changed files. The Plan answer lists only the blobs that the project lacks. The quota counts every declared file.
- The receiver also caps the distinct path prefixes of an upload at 65,536.
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

1. Each project publishes one catalogue. Source: the cloud keys a publication by project, head and config path in `docs/protocol/cloud/publication-upload.md`. Every option keeps it, and the user's rule of 2026-11-28 rules out a split that the project makes.
2. The static output stays complete, and its host runs nothing. Source: `docs/protocol/mokly-export-delivery.md`, Hosting Contract. Every option keeps it.
3. Each view keeps its own document. Source: the renderer receives the colour scheme under `docs/protocol/mokly-rendering.md`, and the measurement shows 0 equal pairs. Every option keeps it.
4. A format number changes only with a change of shape or meaning, and at most once in a release window. Source: `docs/protocol/mokly-format-versions.md`. Every option keeps it.
5. A format change replaces every reader of the old format in the same change, and the cloud converts no stored publication. Source: `docs/protocol/cloud/mokly-artifact-compatibility.md`, Mokly Changes. Options E, G and I of item 8 and option C of item 7 drop the first part. Option G of item 7 drops the second.
6. The receiver quotas stay as they are. Source: the requirements of `docs/protocol/cloud/publication-upload-validation.md:20-42`, and `crates/mkc-mokly-contract/src/limits.rs:33-48`. Their reason is gone: they came from an API whose memory grew with the whole export, as `plans/follow-ups/upload-quotas-not-revisited.md` records. Options B, C, E and F of item 1 drop it.
7. Every build publishes every view of each entry, four for each conductive entry. Source: `docs/protocol/mokly-component-usage-records.md`, Validation. Every option keeps it, and the user's rule of 2026-11-28 rules out fewer views that the project chooses.
8. A publication that is above one limit fails as a whole. Source: `docs/protocol/mokly-upload-validation.md`, Rejections, and `crates/mokly-publish/src/snapshot.rs:77-84`. Option F of item 5 drops it for the comparison, at the CLI's file ceiling only.

## Decisions

The user chose C for item 1 on 2026-11-28. Implementation starts only after the user answers items 2 to 11. Answer each item by its number and letter. Items 6, 7 and 10 come from the plan review of 2026-11-28. The user's rule of 2026-11-28 and the options check of that date changed items 1, 2, 3, 6, 7, 8 and 9.

| #   | Item                                             | Source | Severity | Effort | Recommended                                                                  |
| --- | ------------------------------------------------ | ------ | -------- | ------ | ---------------------------------------------------------------------------- |
| 1   | A large catalogue cannot publish                 | Design | High     | Large  | C, chosen on 2026-11-28: Mokly writes less, and the cloud resizes its quotas |
| 2   | No size target for one publication               | Design | High     | Medium | D: ceilings from what the cloud can safely hold                              |
| 3   | The receiver counts copies and caps growth       | Design | High     | Medium | C: count each file once, and set ceilings for the target                     |
| 4   | The index carries each entry's controls          | Design | High     | Large  | B: each detail carries its own                                               |
| 5   | Pull-request builds copy every document twice    | Design | High     | Large  | C: read snapshots only, and no after side in Mokly Cloud                     |
| 6   | The required smoke blocks the format change      | Review | High     | Medium | D: the smoke chooses its producer by format                                  |
| 7   | Old publications break at the cutover            | Review | High     | Medium | A: keep old publications, and each branch publishes at its next push         |
| 8   | A format change breaks the cloud until a release | Design | Medium   | Medium | F: B, and the runner uses the newest release for an older CLI                |
| 9   | No build time target                             | Design | Medium   | Medium | B: a pull-request build within the 30-minute deadline                        |
| 10  | Usage lists repeat each consumer                 | Review | Medium   | Small  | D: one row for each consumer group that the viewer shows today               |
| 11  | Compact JSON changes every detail id             | Design | Low      | Small  | A: the ids hash the compact bytes                                            |

### 1. A large catalogue cannot publish

- **Severity:** High. **Likelihood:** Common. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mkc-mokly-contract/src/bundle_validation.rs:29-37`, `crates/mkc-mokly-contract/src/json_guard.rs:16`, `crates/mokly-model/src/canonical.rs:42-57` and `crates/mokly-static/src/comparison_files.rs:32-68`.
- **Background:** `mokly publish` builds the static output, and it uploads each file that the project lacks. The receiver checks the declared catalogue before any file arrives. It accepts 512 MiB of declared bytes, 19,999 marker entries, 65,536 path prefixes, an 8 MiB index and 262,144 JSON nodes in the index. The CLI refuses more than 20,000 files before any request.
- **Problem:** Conductive is above four of these limits. Its declared bytes are 1,746 MB, its index has 48.7 MB and 2,162,642 nodes, and its pull-request build has 26,070 files. The recommended size cuts of this plan still leave its current-only output at about 622 MB as declared, above the 512 MiB quota.
- **Impact if no action:** Conductive never publishes. Each other large catalogue meets the same limits.
- **Root question:** How does a large and growing catalogue publish to Mokly Cloud as it is, while the cloud stays protected? The options check of 2026-11-28 replaced the first question, which named the cloud's limits.
- **Shared assumptions:** The plan-wide assumptions. For the comparison only, option F of item 5 drops the rule that a publication above one limit fails as a whole.
- **Options:**
  - **A.** Mokly writes less, and the quotas stay. This needs every Mokly milestone of this plan, option C of item 4 and the HTML work of the design calls. Conductive's current-only build then lands near 452 MB. It fails again near 2,050 entries, and a pull request that changes every view still fails. Effort: Large.
  - **B.** Mokly takes only compact JSON, and the cloud changes its quotas. The cloud counts each stored file once, and it raises each ceiling until conductive fits. The viewer still fetches a 20.8 MB index at each page load, and each build still writes about 0.89 GB. Effort: Medium.
  - **C.** Both. Mokly writes less where the viewer and the build gain. The cloud counts each stored file once, and it sizes its quotas for the target of item 2. Effort: Large.
  - **E.** C, and the index splits into a navigation index and one record file for each folder. The navigation index keeps every fact that the cloud reads. These are the base fields, each record's path, title, `previousPath` and `changes`, and each current screen's view axes. It also keeps the tags, the detail id and the variant parent. On conductive it is 0.74 MB with 60,986 nodes, 35 for each entry. It stays under 262,144 nodes up to about 7,400 entries, or 6,600 for a pull-request build. It reaches 10,000 entries only with the 524,288 nodes of option C of item 3. It changes the index format, the viewer's loading and the receiver's index reader. The options check of 2026-11-27 added it. Effort: Large.
  - **F.** C, and Mokly also removes the copies that it adds to each HTML page. These are the marker `path` and `props` attributes, 34.2 MB, the frame probe templates, 32.6 MB, and the repeated collected style blocks, 43.2 MB. Conductive's current-only output then falls by at most 110 MB, from about 622 MB to about 512 MB as declared. Each page of every catalogue then costs less, also in catalogues with heavier pages. It changes the marker, frame probe and style contracts of every rendered document, which inspection, the frame adapters and the comparison panes read. The options check of 2026-11-28 added it. Effort: Large.
- **Left out:**
  - D. Conductive splits its catalogue into several configurations, or it renders fewer views. The user ruled it out on 2026-11-28, because Mokly must work whatever the setup of a project is.
  - Compress only the upload. Option D of item 3 covers a quota on compressed bytes.
  - One document for both colour schemes. The renderer writes different inline colours for each scheme, and 0 of 3,442 pairs are equal after the scheme marker.
  - The viewer computes `usedBy` itself. It needs every detail, 414 MB as compact JSON.
  - Data from a server at view time. The static host runs nothing, under the Hosting Contract of `docs/protocol/mokly-export-delivery.md`.
  - Upload only the changed files. The exchange already does it, and the quotas count the whole declared catalogue.
  - A size warning in `mokly build`. A receiver can set quotas below the Mokly ceilings, and the CLI does not know them.
- **Wider fix:** C. It removes the copies at their source, and it gives the quotas room for growth.
- **Previous examples:** Item 1 of the workspace "conductivity build issue" on 2026-11-27. The items `plans/follow-ups/compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md` and `upload-quotas-not-revisited.md` hold parts of the same problem.
- **Related:** Items 2 to 5 and item 10, work that waits for the answer. Item 3 applies only under B, C, E and F. Option E also answers item 4. Item 8: conductive pins `@mokly/mokly` 0.21.0, so each option here reaches its cloud build only with option F, H or J there.
- **Recommendation:** C. The Mokly changes make the index and the details fast to load and to build, and only a quota change leaves room for growth. E matters when a catalogue grows far past conductive, because each page load fetches the whole index.
- **Action:** ask the user, because A, B, C, E and F change requirements in force.
- **Decision:** C. On 2026-11-28 the user wrote "ok, lets just go with the current plan", and then "I just meant for point 1".

### 2. No size target for one publication

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `docs/protocol/cloud/publication-upload-validation.md:20-36`.
- **Background:**
  - Each limit binds at a different catalogue size.
  - After the recommended Mokly milestones, a conductive entry costs about 0.33 MB, 6.4 files, 9.0 path prefixes and 88 index nodes in a current-only build.
  - Under option C of item 5, a pull request that changes every view adds more. It adds about 0.24 MB, 4.4 files and 5.7 path prefixes for each entry.
  - Each removed entry that pairs with nothing adds about 114 index nodes and 6.4 files.
  - Conductive has 1,721 entries. It grew from 72 to 664 entry files in 19 days, so it doubled about every six days.
  - On 2026-11-28 the user asked that Mokly works whatever the setup of a project is. Four views is the most that an entry can have, but pages differ. An average conductive screen costs 0.367 MB of HTML, the heaviest tenth of its screens 0.889 MB each, and an average component 0.058 MB.
  - Ready publications stay until their project is deleted, under `docs/protocol/cloud/retention.md`.
- **Problem:** The plan cannot size the quotas, or decide the optional work, without a target.
- **Impact if no action:** The limits fail again soon after the change, or the cloud accepts much more than it needs.
- **Root question:** What sets the largest publication that the cloud accepts, so that the catalogue of any project fits and the cloud and the viewer stay usable? The options check of 2026-11-28 replaced the first question, which asked for one catalogue size.
- **Shared assumptions:** A target in entries becomes ceilings through conductive's cost for each entry. That holds only for catalogues like conductive, because the cost changes with the page size and the mix of screens and components. Options D, F and G drop it. Each option limits only what one upload adds, not what a project stores. Option G drops it. One target serves every project. Option E of item 3 drops it.
- **Options:**
  - **A.** Conductive today with 25% room: about 2,150 entries, for current-only builds and pull requests that change few views. It needs a byte ceiling near 1 GiB of distinct files. A pull request that changes a widely used component can still fail. Effort: Small.
  - **B.** Twice conductive today: about 3,500 entries for every build, also a pull request that changes every view. Such a pull request can also remove about 1,000 entries that pair with nothing, before the 8 MiB index fills. It needs the ceilings of option C of item 3. Effort: Medium.
  - **C.** About 10,000 entries for every build. It needs ceilings about three times those of B. The pull-request index of such a catalogue is about 18 MB, and every page load fetches it. Effort: Large.
  - **D.** No catalogue size. Measure the API memory, the ingest time and the database rows with a synthetic upload. Set each ceiling 25% below the measured safe bound, and report the entry count that fits. The receiver does not check entry details yet, so `plans/follow-ups/receiver-read-model-validation.md` must measure again. The ceilings can then be far above any real need, so one upload can use a lot of storage. The options check of 2026-11-27 added it. Effort: Medium.
  - **E.** B, and a pull request may also replace every entry, so that 3,500 removed entries stand beside 3,500 current ones. With 25% room, it needs about 972,000 index nodes, a 16 MiB index, about 56,000 files and 2.9 GB of distinct bytes. Option E of item 4 fits it within the ceilings of option C of item 3, without room. The plan review of 2026-11-28 added it. Effort: Medium.
  - **F.** D for the bytes, the files, the path prefixes and the marker. The index keeps a page-load limit, such as 8 MiB with the 524,288 nodes of option C of item 3. A pull-request index costs about 1,844 bytes for each entry, so that limit holds about 4,500 entries. A larger catalogue then needs option E of item 1. The options check of 2026-11-28 added it. Effort: Medium.
  - **G.** D, and a stored-bytes quota for each workspace that its plan sets. It limits what a project stores across all its publications, which no ceiling for one publication does. It is a pricing choice. It needs usage accounting with a migration, a refused-upload state with product copy and a mockup, and a default for environments without billing. The options check of 2026-11-28 added it. Effort: Large.
- **Left out:** None. The options check of 2026-11-27 brought back the approach without a target as D.
- **Wider fix:** None. A target is a policy, not a fix.
- **Previous examples:** Option B of `plans/follow-ups/upload-quotas-not-revisited.md` proposed the measurement of D.
- **Related:** Item 3 takes its ceilings from this answer. Item 5 needs option C or a later option under B, C or E here. Item 4: its option E serves E here. Item 1: F here needs its option E above about 4,500 entries. Milestone 8 gives the answer its own acceptance case.
- **Recommendation:** D, changed from B on 2026-11-28. The user's rule asks Mokly to work whatever the setup is, and a target in conductive entries fits only catalogues like conductive. D sets each ceiling from what the cloud can safely hold, and it reports the entry count that fits. F protects page loads best, and G is the only option that limits what a project stores.
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
  - The receiver caps the distinct path prefixes at 65,536. A conductive entry adds about 9.0 prefixes in a current-only build and about 14.7 with a before side.
  - The 48 MiB marker quota covers 19,999 entries with the longest path. A 64 MiB file holds only about 31,000 such entries.
  - API memory no longer grows with the file bytes. Its headroom still covers at most 20,000 path and index records, as `docs/ops/environment.md`, API Upload Memory Sizing, says.
  - Preview capture keeps its own lower limits of 19,999 missing blobs and 512 MiB, in `infra/scripts/catalogue_capture_plan.py:17-18`. Capture runs only on the mockup catalogue of this repository.
- **Problem:** After the recommended Mokly milestones, conductive's current-only output is about 622.0 MB as declared and 565.4 MB as distinct files. Both are above 512 MiB. A pull request that changes every view adds about 412 MB and 7,520 files, which gives about 1,034 MB and 18,550 files.
- **Impact if no action:** Conductive cannot publish after the Mokly milestones, unless Mokly also takes the HTML work of option A of item 1.
- **Root question:** Which limits must a publication meet, so that the target fits and the cloud stays protected?
- **Shared assumptions:** One set of quotas serves every project. Option E drops it. The receiver checks each quota at Plan time, from the declared decoded sizes, so that it refuses before any Blob. Option D must change this.
- **Options:**
  - **A.** Keep every quota and ceiling. It needs option A of item 1. Effort: Large.
  - **B.** Count each distinct file once, and keep the ceilings. The declared-bytes quota gets its own number, apart from the plan-archive quota. Conductive is still about 5% above 512 MiB. Effort: Small.
  - **C.** B, and set each ceiling for the target of item 2 with 25% room. These ceilings assume option B of item 4. For option B of item 2, they are:
    - 2.5 GiB of distinct bytes, 50,000 files and an 8 MiB index.
    - 524,288 JSON nodes for the marker and for the index.
    - A prefix quota of three for each file, 150,000.
    - A marker byte quota that follows the file ceiling, up to the 64 MiB file ceiling.
    - A plan-archive member count of its own, apart from the file ceiling.

    The marker keeps the 64 MiB file ceiling, so 50,000 files fit when the average marker entry stays under about 1,340 bytes. Conductive's entries average about 237 bytes, and 64 MiB holds about 31,000 entries with the longest escaped paths. The CLI file ceiling changes too. Measure the API memory, the record count and the ingest at the new bounds, with conductive's nested path layout. Under option D of item 2, that measurement sets each number. Effort: Medium.

  - **D.** Count the gzip size of each distinct file, and store and serve gzip blobs. Today's conductive output is 188.6 MB this way. The marker declares only decoded sizes. So D also needs encoded sizes in the marker, which takes marker version 4, or a check after the Blobs. It does not change the file, prefix or index limits. Effort: Large.
  - **E.** A Team workspace gets the ceilings of C, and a free workspace keeps today's quotas. The receiver already gates an upload on the workspace plan, under `docs/protocol/cloud/billing-plan-gates.md`. It is a pricing choice, an environment without billing needs a default, and a refused free upload needs product copy. The options check of 2026-11-27 added it. Effort: Large.
  - **F.** C, and the marker gets its own ceiling above 64 MiB in the exporter, the CLI and the receiver. Then 50,000 entries with the longest paths fit. It reverses the decision of `docs/protocol/cloud/publication-upload-validation.md` to size the marker without relaxing the file ceiling, and the Plan memory needs a new budget. The plan review of 2026-11-28 added it. Effort: Medium.
- **Left out:**
  - Count only the bytes that one upload adds. The first publication of a project adds every byte, so a ceiling for the whole catalogue stays.
  - Remove the quotas. A bound keeps one upload from using up storage and time.
  - Remove the prefix quota. 50,000 files of 64 segments allow 3.2 million prefixes, far above the memory bound of the upload API.
  - Count each distinct file once in the file limit. Each path costs a database row and a marker entry, whatever its digest.
- **Wider fix:** C. Each ceiling then follows a stated target, the prefix and marker quotas follow the file ceiling, and duplicates never count.
- **Previous examples:** `plans/follow-ups/upload-quotas-not-revisited.md` asked to measure the quotas, and no measurement exists.
- **Related:** Item 1: this item applies only under B, C, E or F there. Item 2 gives the target. Item 4: options A and D need higher index quotas here, and these ceilings assume option B there.
- **Recommendation:** C. It counts what the cloud stores, and each ceiling has a reason that a later change can check.
- **Action:** ask the user, because each option except A changes the quotas of `docs/protocol/cloud/publication-upload-validation.md` or the ceilings of `docs/protocol/mokly-upload-validation.md`.

### 4. The index carries each entry's controls

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-model/src/projection_records.rs:47-71`, `crates/mokly-model/src/usage_schemas.rs:22-36` and `packages/viewer/src/shell/control_values.ts:196-227`.
- **Background:** Each screen and component record of the index carries `propSchema`, `props` and `controls`. The viewer reads them for the Props panel of the shown entry. It also reads a component's `props` beside the detail's `before` props in a comparison, in `packages/viewer/src/shell/public_compared.ts:42-44`. The detail already carries `controlOrder`. Conductive's 957 screens use 33 distinct control sets. The Rust usage check reads the component schemas from the index. Props shows its own loading line and **Try again** until the route's details arrive, under `docs/protocol/mokly-component-controls.md`. A decision in force in `docs/protocol/mokly-shell-delivery.md:42-44` chose compression over a smaller index format, because compression keeps every canonical byte and every read of the viewer.
- **Problem:** These three fields are about 18 MB of the 20.8 MB compact index, and 2,011,954 of its 2,162,642 nodes. Each page load fetches and parses them.
- **Impact if no action:** The receiver refuses the index, and every page load of a large catalogue is slow.
- **Root question:** Where do an entry's prop schema, saved props and controls live, so that page loads stay small and the receiver accepts the index?
- **Shared assumptions:** The viewer fetches and parses the whole index at each page load, under `docs/protocol/mokly-export-delivery.md`. Option E of item 1 drops it. The decision for compression over a smaller index does not cover the node quota or the parse time. Options A, B and C reverse that decision, and D keeps it.
- **Options:**
  - **A.** Tables in the index hold each distinct control set and prop schema once. The index is 4.7 MB with 393,285 nodes, already above the quota of 262,144 nodes. At the target it is about 12.7 MB with about 1,095,000 nodes, so it needs an index quota of 16 MiB and 2,097,152 nodes. Effort: Medium.
  - **B.** Each entry's detail carries its own prop schema, saved props and controls. The index is 2.85 MB with 150,688 nodes, 88 for each entry. The details grow by about 18 MB, because screens repeat their shared schema. The usage check reads component schemas from the component details. Props then waits for the detail, and the shell model joins the fields onto each record with an `omitted` state until the detail holds them. Effort: Large.
  - **C.** B, but one shared file holds each distinct prop schema and control set by digest. The details grow by about 1.3 MB, and the shared file is about 0.6 MB. The viewer fetches one more file before it shows controls. Effort: Large.
  - **D.** Keep the index, and raise the index quotas to 64 MiB and 8,388,608 nodes. Each page load of conductive today fetches 20.8 MB, 4.4 MB with gzip, and parses it. At the target a page load fetches about 54 MB. Effort: Small.
  - **E.** B, and each removed record of the index keeps only its navigation fields. Its views and display details move to the removed detail that the generation already holds. A removed record then costs about 32 nodes and 430 bytes, not about 114 nodes and 1,900 bytes. A pull request that removes 3,500 entries beside 3,500 current entries then fits the ceilings of option C of item 3. The plan review of 2026-11-28 added it. Effort: Large.
- **Left out:**
  - Omit only the copies on variants, option B of `plans/follow-ups/variant-prop-schema-copies.md`. These copies are 10.07 MB and 1,114,589 nodes, but the index then keeps about 1,048,000 nodes, four times the quota. So it fails the goal.
  - Each reader derives the controls from the prop schema. The sidecar adds Storybook `argTypes` to the derived controls, so the read model must carry the result.
- **Wider fix:** B. No entry field then grows the index.
- **Previous examples:** `plans/follow-ups/variant-prop-schema-copies.md`. PR #223 kept a component's usage lists only in its parent detail.
- **Related:** Item 1: option E also splits the index. Item 2: option E there needs E here. Item 3: options A and D need higher index quotas there. Item 8: A, B, C and E need index version 10 and entry detail version 5.
- **Recommendation:** B. The index keeps only what navigation needs, and each detail stays complete for the entry that it serves.
- **Action:** ask the user, because each option changes a format or the receiver quotas, and A, B and C reverse a decision in force.

### 5. Pull-request builds copy every document twice

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-static/src/comparison_files.rs:32-68`, `crates/mokly-static/src/comparison_output.rs:24-83` and `docs/protocol/mokly-comparison-panes.md:28-56`.
- **Background:**
  - A pull-request build writes a comparison generation. It copies every document, resource and public file of each side under `snapshots/before/` and `snapshots/after/`.
  - The viewer fetches a snapshot only for a comparable view and for a removed entry. An after document is the current document without the frame probe. The viewer reads a pane document with scripts disabled.
  - Mokly Cloud serves each publication at its own host with its exact stored bytes. A generic static host can replace a current document in place between the deployment check and the fetch of a pane.
- **Problem:** A pull-request build of conductive against its parent commit wrote 26,070 files and 2,580.5 MB. Its generation held 7,520 before files and 7,520 after files, 823.5 MB, although no view was comparable. The CLI refuses more than 20,000 files before any request.
- **Impact if no action:** Conductive's pull requests never publish, so its GitHub check never runs.
- **Root question:** How does a pull-request publication of a large catalogue fit the upload limits, so that its check runs and its comparisons load? The options check of 2026-11-27 replaced the first question, which named snapshot files.
- **Shared assumptions:** A publication that is above one limit fails as a whole. Option F drops it. The output holds each pane document under the generation. B narrows it, C, G, H and I drop it for the after side, F drops it when its trigger applies, and D drops it. Snapshot bytes are the composed documents. E drops it.
- **Options:**
  - **A.** Keep both full sides. Effort: Small.
  - **B.** Write snapshots only for the views of comparable entries, for removed entries, and for each document that a kept document embeds. Write only the resources of the kept documents. This is option C of `plans/follow-ups/unread-comparison-snapshots.md`. A pull request that changes every view still writes both sides. Effort: Medium.
  - **C.** B, and `mokly publish` writes no after side. The upload exchange then requires a receiver to keep each publication at an origin whose files never change. Mokly Cloud already does. The after pane then reads the current document. `mokly build` keeps the captured after side for generic hosts, and Serve keeps its own. The fixture generator and the live smoke then check the real `publish` output, which a refused `publish` leaves in its private directory. The plan review of 2026-11-28 narrowed C to these hosts. Effort: Large.
  - **D.** The cloud builds a large pull request current-only. Its check and its viewer then show no Changes. Effort: Small.
  - **E.** A static build keeps the frame probe in each snapshot document. An after snapshot then equals its current document, and an unchanged before snapshot has the same bytes. The distinct count of item 3 and the blob store keep each such file once. The file count and the path prefixes still double, so the prefix quota of 65,536 holds only about 3,200 entries. The options check of 2026-11-27 added it. Effort: Medium.
  - **F.** When a pull-request build would be above the CLI's file ceiling, the build drops the pane documents, publishes, and warns. The index and the details keep Changes, so the check runs, and the viewer shows each comparison as unavailable.
    - F recovers only from the file ceiling, which the CLI checks. The rest of the catalogue must still meet every receiver quota.
    - A trigger that sees more limits costs more. Examples are one re-plan without panes after an HTTP 413, or a receiver that states its limits before the build. Under option E of item 3, the CLI does not know the quotas of a free workspace.
    - A ready publication without panes wins every later upload of its commit.
    - It needs a format field, a viewer state with its copy, and a mockup. The options check of 2026-11-27 added it. Effort: Large.
  - **G.** C, and the rule that the user chose on 2026-10-27. The build writes no before document that equals its after document, and the before pane reads the current document. The five open decisions of `plans/follow-ups/skip-equal-before-snapshots.md` come with it. Its checks of the `publish` output follow C. The options check of 2026-11-27 brought it back. Effort: Large.
  - **H.** B, and one immutable root holds the whole current tree, with its HTML and its local files, on every host. Browse and the after pane both read it, so relative references keep working. It changes the address of every view and each reader of `static/mokly-generated/`. The plan review of 2026-11-28 added it. Effort: Large.
  - **I.** B, and no build writes an after document. The generation keeps the after resources and each document that an after document embeds.
    - The viewer reads the after document from its current address. It accepts the document only when its SHA-256 equals the digest that the detail records for that view.
    - The viewer resolves the document's addresses against its after address inside the generation, so a replaced stylesheet or image never reaches the pane.
    - It needs a detail field, SHA-256 code for plain-HTTP origins, and about 1,300 more files at the target. A host that rewrites HTML loses its comparisons, and a host that deletes an old generation can drop a pane's styles.
    - `mokly build` and `mokly publish` then write one output. The plan review of 2026-11-28 added I and then rewrote it. Effort: Large.
- **Left out:**
  - A before pane that reads the base commit's own publication. The output must stay complete, and a merge base can have no publication.
  - A snapshot store by content inside the output. The viewer cannot rewrite addresses inside stylesheets, and the receiver already stores each digest once.
  - A second deployment check after the pane's HTML arrives. Its later resource requests still fall outside the check.
  - A digest of the after HTML alone, with its resources read from the current tree. A deployment can keep the HTML and replace a resource.
- **Wider fix:** F for the class of builds above a ceiling, as the options check of 2026-11-27 found. H for the class of mixed deployments, as the plan review of 2026-11-28 found.
- **Previous examples:** `plans/follow-ups/unread-comparison-snapshots.md`, `skip-equal-before-snapshots.md` and `snapshot-resource-copies.md`. When a base fails validation, the CLI already publishes without a comparison, under `docs/protocol/cloud/cloud-build-runner.md`.
- **Related:** Item 2: its options B and C need C or a later option here. Item 3: E relies on its distinct count. Item 8: C adds an index field for the after source.
- **Recommendation:** C. In Mokly Cloud, a pull request that changes every view then adds one copy of each document, not two. Every other host keeps today's guarantee. F protects best against the file ceiling, and H against mixed deployments.
- **Action:** ask the user, because B, C, E, G, H and I change the generation rules of `docs/protocol/mokly-changes-serving.md`, `mokly-export-delivery.md` and `mokly-comparison-panes.md`. C also adds a receiver rule, and F adds a viewer state.

### 6. The required smoke blocks the format change

- **Severity:** High. **Effort:** Medium.
- **Source:** Review.
- **Category:** Process.
- **Location:** `scripts/cloud/publication_smoke_cli.py:74-79`, `scripts/cloud/publication_smoke_consumer.py:20`, `crates/mkc-catalogue-server/tests/publish_tests.rs:105-133` and `docs/protocol/cloud/mokly-fixture-regeneration.md:28-32`.
- **Background:** The complete gate runs a smoke test that installs `@mokly/mokly@latest` from npm and publishes to the API of the branch. `Required CI` needs that job, and a release publishes only after `Required CI` passes on its tree. The user chose this published-package smoke on 2026-11-19, in PR #350. No format number has changed since then.
- **Problem:** After the format change, the receiver of the branch accepts only index version 10, and the newest release writes index version 9. So the smoke fails on the format pull request, and on the release pull request that must ship index version 10.
- **Impact if no action:** The format change can neither merge nor release.
- **Root question:** How does every commit from a receiver format change to its first release pass the required gate, and still prove a real CLI publish?
- **Options:**
  - **A.** Run the full smoke with the workspace CLI before the merge, and the published-package smoke after the release. The proof of package installation moves past the merge. Effort: Medium.
  - **B.** Pack and install a release candidate of the branch before the merge. Run the full exchange with it, and prove that the old release gets HTTP 426. Repeat the smoke with the published package after the release. The pack route covers six packages, also the native one. Effort: Large.
  - **C.** Publish a producer candidate before the receiver changes, and test that exact package in the gate. It adds a release route and registry coordination. Effort: Large.
  - **D.** The smoke chooses its producer by format. When the receiver refuses the format of the newest release, the smoke requires HTTP 426 from it. It then runs the full smoke with the workspace CLI. Otherwise it runs as today. It reads the accepted formats from one record. It changes the rule that the live smoke publishes with the newest npm release. Effort: Medium.
  - **E.** Stage the format change across a release, as option E of item 8. The receiver accepts index version 9 and index version 10 until the first index 10 release, so the smoke keeps the newest release. Effort: Large.
- **Left out:**
  - Update only the expected index version. The producer and the receiver still disagree.
  - An admin merge. The release pull request runs the same smoke, so no passing run exists for the release.
  - A temporary skip of the smoke. The gate then proves no real publish.
- **Wider fix:** D. Its choice by format prevents the block at each later format change. It compares every format that the receiver gates: the envelope, the marker and the index.
- **Previous examples:** PR #350 added the published-package smoke on 2026-11-19.
- **Related:** Item 8: its options E, G and I remove this problem, and its other options need an answer here. Item 7: under option E here, the index 9 publications of the window also meet the cutover of item 7.
- **Recommendation:** D. It ends the block at this and every later format change, and the newest release stays in the required smoke on every commit. B protects the package contents best before the release.
- **Action:** ask the user, because D changes the rule that the required smoke publishes with the newest npm release, which the user chose on 2026-11-19.

### 7. Old publications break at the cutover

- **Severity:** High. **Effort:** Medium.
- **Source:** Review.
- **Category:** Docs or spec.
- **Location:** `crates/mkc-publications/src/reservation/reserve.rs:68-83`, `docs/protocol/cloud/viewer-host.md:100-124` and `docs/ops/deploy.md:800-803`.
- **Background:** A ready publication wins every later upload of the same project, commit and config path. The new app viewer reads only the new formats. The 0.18 cutover reset each stable environment, as the user chose on 2026-10-26. The cloud converts no stored publication.
- **Problem:** After the change, each ready publication from before the cutover shows the viewer's version error. A new upload of the same commit returns that old publication. The screens read and the check render of a kept index 9 publication also fail, because they share the index reader of upload admission. Ready publications never expire, under `docs/protocol/cloud/retention.md`.
- **Impact if no action:** A project can republish, get a success result, and still see a catalogue that the viewer cannot open.
- **Root question:** What happens to the projects, the stored publications and their links when a format change leaves the cloud unable to read the stored catalogues?
- **Options:**
  - **A.** Keep old publications as history, and publish a new commit for each active branch. Document what old links show. The screens read and the check render of old publications still fail. Effort: Medium.
  - **B.** Expire the incompatible ready publications in a controlled cutover, and republish their commits. It changes retention and the old addresses. Effort: Large.
  - **C.** Serve a matching viewer for old publications. Each publication stores its own viewer shell, which its catalogue origin serves at `/`, and the app origin may frame it, under `docs/protocol/cloud/catalogue-hosting.md` and `catalogue-delivery.md`. The app then opens an older publication in that shell instead of the version card. It loses the cloud's viewer slots, such as Share, and the new state needs a mockup and copy. It changes the rule of `docs/protocol/cloud/viewer-host.md` that each publication opens in the app's viewer. The screens read and the check render still fail. The options check of 2026-11-28 corrected C, which first named a registry copy of an older viewer. Effort: Large.
  - **D.** Reset each stable environment, as the 0.18 cutover did. Then republish the dogfood catalogue, recreate the labelled previews, and run the preview and publish proofs. The reset deletes every account, workspace, project, token and publication. Stripe keeps its live subscriptions. Effort: Small.
  - **E.** Make the format part of the winner rule. A ready winner of an older format then loses to an upload of the same commit in the current format. Only the winner changes: an old link that nobody republishes keeps the version error. It needs a migration, and it changes two cloud pages. Effort: Large.
  - **F.** A, and the version error of an older catalogue links the newest catalogue of its branch. It needs a mockup and product copy. Effort: Large.
  - **G.** A one-time job converts each stored publication to the new formats. It reverses the decision that the cloud converts no stored publication, and each later format change needs its own converter. Effort: Large.
- **Left out:** Republish an unchanged commit. It returns the same old publication.
- **Wider fix:** C, with the screen and check facts stored apart from the index. Old links and their server reads then survive later cutovers.
- **Previous examples:** The 0.18 cutover reset each stable environment, under `docs/ops/mokly-release-cutover.md`.
- **Related:** Item 8: under its options G and I, the cloud keeps reading older publications, so this problem goes away. The cutover happens under each other option. Item 6.
- **Recommendation:** A, changed from D on 2026-11-28. The reset of D deletes every project, so each project must set up again, which conflicts with the user's rule of 2026-11-28. A keeps every project and its setup, and each branch gets a readable catalogue at its next push. Option I of item 8 keeps old publications readable too. Under A, C, E or F, the conditional question of Implementation Order decides the server reads of old publications.
- **Action:** ask the user, because D deletes every account of each stable environment, and each other option changes a requirement in force.

### 8. A format change breaks the cloud until a release

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Process.
- **Location:** `crates/mkc-mokly-contract/src/index.rs:30-37`, `crates/mkc-build-sandbox/src/versions.rs:6` and `docs/ops/mokly-release-cutover.md`.
- **Background:** Each push to `main` deploys the cloud with the workspace packages. The receiver accepts one index number, and the app's viewer reads one detail number. Customers and the cloud build runner publish with released CLIs. The runner uses the CLI that each repository installs, or the newest release. The rule in `docs/protocol/cloud/mokly-artifact-compatibility.md`, Mokly Changes, says that a protocol addition that the cloud requires must already exist in a published release. Compact JSON and the quota changes need no new format number.
- **Problem:** From the merge of index version 10, the receiver refuses each released CLI that writes index version 9 with HTTP 426. Each project fails until it upgrades its own CLI to a release that writes index version 10. Options A to D and F break the release rule above for that window. In that window the API's 426 text tells publishers to install 0.18.0, which the receiver refuses. A cloud build that gets HTTP 426 ends as `upload-rejected`, whose card says to check the output.
- **Impact if no action:** Every cloud publication fails in that window, and each separate format release adds another window and another cutover.
- **Root question:** How does each project keep publishing, whatever Mokly release it installs, when a format change reaches the cloud? The options check of 2026-11-28 replaced the question of 2026-11-27, which also asked how to group the pull requests.
- **Options:**
  - **A.** One branch and one pull request for every milestone, then a release. Compact JSON and the quotas wait for the format work. Effort: Small.
  - **B.** Two pull requests. The first carries the documentation, compact JSON and the quotas. The second carries every format change, and a release follows it. The first alone does not let conductive publish, because its compact index still has 2,162,642 nodes. The 426 text then names the last release that the receiver refuses. An example is "Update Mokly to a release newer than 0.22.0, then publish again." It changes the text of `docs/protocol/cloud/rest-api-surface.md`, and A, C and D take the same text. Effort: Small.
  - **C.** One pull request for each milestone, and no release until the last format change merges. The cloud refuses released CLIs from the first format merge to that release. Effort: Medium.
  - **D.** One pull request and one release for each format change. Each takes its own index number and its own cutover. Effort: Large.
  - **E.** Stage the format change across a release. The receiver and the app viewer read both format families until the first release that writes the new one. A later pull request then removes the old family. Released CLIs keep publishing, and the release rule holds. It reverses the decision against two format families, and it adds a third pull request. The plan review of 2026-11-28 added it. Effort: Large.
  - **F.** B, and the cloud build runner publishes with the newest release when a repository's CLI is below the floor. Today such a run ends as `UnsupportedMoklyVersion`.
    - After the release, the floor rises to the first release that writes index version 10. A project that keeps an older CLI then still publishes through the cloud. Until that floor raise deploys, an older CLI still gets HTTP 426.
    - In npm 11.21.0, a `@latest` spec that the local tree does not match installs into the exec cache, whose bin directory comes first on `PATH`. So the runner can run the newest release beside an older install.
    - The sidecar serves each `@mokly/mokly` import of a mockup from the CLI that runs, in `packages/mokly/src/sidecar/plugins.ts:83-109`. So two releases never mix in one build.
    - A helper or a configuration input that the newest release removed fails the build with its own error.
    - The copy of `unsupported-mokly-version` then covers only a CLI that cannot start, so its text in `packages/app/src/viewer/build-copy.ts:30-31` and `crates/mkc-publications/src/build_check_summary.rs:170` changes.
    - A `mokly publish` from a developer machine with an older CLI still gets HTTP 426. From the merge to the release, every released CLI gets HTTP 426, as under B.
    - It changes the rule of `docs/protocol/cloud/cloud-build-runner.md` that ends a run with a CLI below the floor. The user's rule of 2026-11-28 led to it. Effort: Medium.
  - **G.** E, and no later pull request removes the old family. The receiver, the app viewer, the screens read and the check render keep reading each format that a release since the floor wrote. No project then has to upgrade to publish, also from a developer machine. It reverses the decision against two format families for good, and each later format change adds one more family to read. Conductive's 0.21.0 output still breaks the quotas, so G reaches conductive only with F, H or J. The user's rule of 2026-11-28 led to it. Effort: Large.
  - **H.** The runner always publishes with the newest npm release, also when the repository installs a CLI.
    - It needs no version floor, and no floor raise after each format release.
    - It also works around an older local CLI that cannot start, which `plans/follow-ups/runner-reports-missing-native-package-as-old-mokly.md` and `own-mokly-check-runs-unbuilt-workspace-cli.md` weigh. A broken install of the newest release itself still fails, because npm reuses it.
    - It ignores the release that each project chose, so a cloud build can differ from the project's own CI. The accepted risk that the newest release is newer than the deployed cloud then applies to every build.
    - The options check of 2026-11-28 brought it back from Left out. Effort: Medium.
  - **I.** The receiver accepts index version 9 beside index version 10 with its one reader. That reader decodes only fields that items 4 and 5 keep, in `crates/mkc-mokly-contract/src/index_document.rs:1`. The app opens a publication of an older format in its own stored viewer shell, framed from its catalogue origin, instead of the version card.
    - Released CLIs keep publishing through the merge and the release, and the release rule holds.
    - The newest release passes the required smoke, so item 6 loses its problem. Old publications keep a viewer, their screens read and their check render, so item 7 needs no reset.
    - An older publication loses the cloud's viewer slots, such as Share, and the new state needs a mockup and copy. It widens the index gate of `docs/protocol/cloud/mokly-artifact-compatibility.md`.
    - The planned check of every entry detail must skip older formats or keep their readers. Under option E of item 1, the receiver's reader changes and needs a second projection.
    - Conductive's 0.21.0 output still breaks the quotas, so I reaches conductive only with F, H or J. The options check of 2026-11-28 added it. Effort: Large.
  - **J.** The runner publishes with the CLI of the deployed cloud commit, packed with its native package.
    - Cloud builds then match the receiver from the merge on, at every later format change, with no floor.
    - Unreleased code then builds customer catalogues, and the API image or the build template must carry the packed CLI.
    - It ignores the release that each project chose. It reverses the rejection of the workspace CLI in `docs/protocol/cloud/cloud-build-runner.md`, although preview capture already publishes with the workspace CLI, under `docs/ops/preview.md`.
    - A `mokly publish` from a developer machine still gets HTTP 426. The options check of 2026-11-28 added it. Effort: Large.
- **Left out:**
  - A prerelease that a project pins before the merge. The release docs name only the `latest` dist-tag, and a pin is a change in the project. Conductive cannot publish before the format change in any case.
  - The receiver converts an older upload to the new format. The cloud serves the exact bytes of each declared file, and a converted detail no longer matches its declared digest.
  - A deploy freeze from the merge to the release. Until the deploy, the receiver then refuses the new release instead of the old ones.
  - A CLI that reruns itself with the newest release after HTTP 426. No released CLI does it, and HTTP 426 ends the exchange without a retry, under `docs/protocol/mokly-upload-validation.md`.
- **Wider fix:** G for each publisher whose old output fits the quotas, and J for the cloud build. F prevents the class only while each format release raises the floor.
- **Previous examples:** Release 0.18.0 shipped index version 9 and entry detail version 4 together, from PR #224. `plans/follow-ups/runner-reports-missing-native-package-as-old-mokly.md` and `own-mokly-check-runs-unbuilt-workspace-cli.md` weigh the same `@latest` fallback for a CLI that cannot start.
- **Related:** Items 4 and 5 hold the format changes. Item 6: E, G and I remove its problem. Item 7 holds the cutover, and under G and I the cloud keeps reading old publications. Item 1: each of its options reaches conductive only with F, H or J here.
- **Recommendation:** F, changed from B on 2026-11-28. It is the smallest change that publishes conductive as it is, and each project keeps its chosen release while the cloud accepts it. It reads a CLI upgrade in conductive as a change that the user's rule forbids. I protects older publishers and older publications best, and it can combine with F.
- **Action:** ask the user, because no option is clearly best: they trade early savings, review size, refusal time and reader code. A to D and F also break the release rule. F, H and J change rules of the build runner, and G and I change the rules of artifact compatibility. The answer also depends on whether the user's rule covers the Mokly release that a project installs.

### 9. No build time target

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-static/src/assembly.rs:101-110`.
- **Background:**
  - The current-only build of conductive took 12 min 54 s here, with a 4.64 GB peak. Its pull-request build took 56 min 2 s with 2 sidecars, on 4 vCPU.
  - Today's build template has 2 vCPU and 4 GiB, under `docs/protocol/cloud/cloud-build-template.md`.
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
- **Recommendation:** B, changed from A on 2026-11-28. Under the user's rule of 2026-11-28 a large catalogue must publish, and a build above the attempt deadline publishes nothing. A keeps this plan apart from the work of the other workspaces, and it only measures the time.
- **Action:** ask the user, because the user asked for this choice.

### 10. Usage lists repeat each consumer

- **Severity:** Medium. **Effort:** Small.
- **Source:** Review.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-model/src/projection_usage.rs:10-104`, `packages/viewer/src/shell/workspace_usage.tsx:68-122` and `docs/protocol/mokly-live-evidence.md:112-124`.
- **Background:** `usedBy` and `affected` hold one link for each instance and view of each consumer. Each link repeats the consumer's path, kind and title. The viewer groups the links into one row for each consumer kind, path, removal state and eligibility, with counts and the first link. The rule in `docs/protocol/mokly-live-evidence.md` forbids the merge of distinct view, instance, ownership, removal or eligibility contexts in `affected`.
- **Problem:** The lists are 85.1 MB of conductive's compact details. `icon-button.json` alone has 44,206 links.
- **Impact if no action:** The details stay about 72 MB larger than needed, and the largest detail stays 16.8 MB.
- **Root question:** How can usage lists shrink while they keep each comparison destination and its counts?
- **Options:**
  - **A.** Keep the links as they are. The details are 222.7 MB after the other steps. Effort: Small.
  - **B.** One row for each consumer, with separate actions for Current and Compare. It changes the inspector, and it needs a mockup. Effort: Medium.
  - **C.** Keep every `affected` link, and write rows only for `usedBy`. Effort: Medium.
  - **D.** One row for each group that the viewer shows today. Links share a row when every field except the view, the instance key and `direct` is equal, also each field added later. A row keeps first-seen order, the counts, `direct` and the first link. The details are 150.2 MB. It changes the rule of `mokly-live-evidence.md`. Effort: Small.
  - **E.** One row for each consumer and removal state, whose link names the first view that can compare. It drops the separate Current link of a consumer with mixed views, and it changes a tested split. Effort: Small.
  - **F.** Keep every link. Each list holds a table of its consumers once, and each link names its consumer by position. The details are 202.2 MB, and the rule keeps its meaning. Effort: Medium.
- **Left out:**
  - The first link for the whole consumer. It can drop the only view that can compare.
  - A list that stops after its first consumers. A component page must link every known consumer.
  - A separate usage file. The quota counts its bytes too.
- **Wider fix:** D. Its rule also splits rows on each field added later.
- **Previous examples:** PR #223 kept a component's usage lists only in its parent detail.
- **Related:** Items 1 and 3: the totals of this plan use D.
- **Recommendation:** D. It gives exactly the rows that the viewer shows, and it saves 52 MB more than F. F keeps the rule of `mokly-live-evidence.md`.
- **Action:** ask the user, because D changes a rule in force, and F keeps that rule at 52 MB more.

### 11. Compact JSON changes every detail id

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-model/src/canonical.rs:87-117`, `docs/protocol/mokly-catalogue-serialization.md`, Detail Identity, and `docs/protocol/mokly-export-delivery.md:102`.
- **Background:** A detail id is the SHA-256 of the detail's canonical JSON, with its id and its revision zeroed. The deployment id hashes the output. Static delivery promises that a detail with the same id keeps the same bytes. No reader computes a detail id again, so released CLIs keep publishing after the change. The project is not in production.
- **Problem:** Every catalogue gets new detail ids and a new deployment id one time. The first publication after the change uploads every detail again. An open tab reloads at its next detail request, because the deployment id changes.
- **Impact if no action:** None beyond that one time.
- **Root question:** What may readers and hosts rely on for an unchanged detail when its files become compact? The plan review of 2026-11-28 replaced the first question, which named the detail id.
- **Options:**
  - **A.** The ids hash the compact bytes. Every id changes one time, and an equal id still means equal bytes. Effort: Small.
  - **B.** The ids keep hashing the two-space form, while the files are compact. The ids stay, but the file digests and the deployment id still change, so the upload and the reload are the same. The reuse rule of `docs/protocol/mokly-shell-fences.md` still holds, because an equal id still means equal content. B rewrites two requirements: the id preimage becomes a second, two-space form, and an equal id then promises equal content, not equal bytes. A second encoder stays, and Serve encodes each changed detail twice. Effort: Small.
- **Left out:**
  - Keep two-space detail files. It gives up 832 MB of the saving.
  - Two ids for each detail, one for content and one for bytes. The marker already names the bytes of each file, and a second id adds index nodes.
- **Wider fix:** None. Option A keeps one canonical encoding.
- **Previous examples:** PR #224 changed every detail id one time, when details got content ids.
- **Related:** None.
- **Recommendation:** A. B saves nothing, because the upload and the reload are the same under both options, and it weakens a promise of static delivery.
- **Action:** ask the user, because the user asked to confirm the one-time change of the ids.

## Design Calls

Each call is mine, made on the date it names under the decision test. Each one holds under the recommended answers.

- 2026-11-27: Compact JSON takes no new format number. Reason: the format rule raises a number only for a change of shape or meaning, and every reader ignores whitespace.
- 2026-11-27: One canonical form serves every JSON file of the output. These files are the index, the details, the generation details, the removed previews, the deployment file, the marker and the upload manifest. Reason: one encoder. Today the marker and the manifest use pretty output at `crates/mokly-model/src/output/artifact.rs:64` and `crates/mokly-model/src/output/upload.rs:128`.
- 2026-11-27: Compact JSON changes no key and no HTML byte. Reason: `propsKey`, instance keys and slot keys hash compact `serde_json` bytes in `crates/mokly-model/src/material.rs:19-42`.
- 2026-11-28: Instance props stay inline. Reason: once views share their records, a props table in each detail saves only about 4.1 MB. Inline props keep `CatalogueUsage` as the render answer, the frame adapters and inspection read it. The decision of 2026-11-27 covers "bound or deduplicate the usage records".
- 2026-11-27: A view whose usage record equals an earlier view of the same detail names that view instead of a copy. Reason: 781 of 1,721 entries have four equal views, and the change saves 178.6 MB. On 2026-11-28 the plan review moved the reference into the encoded detail only. The detail encoder, which `build` and Serve share, names the earliest equal ready view, and every reader resolves the reference when it decodes a detail. So each in-memory view holds its own `CatalogueUsage`, and no reader or per-view writer can pick a wrong record.
- 2026-11-27: The detail omits the instance `source`. Reason: no reader of a detail uses it, and the core only validates it in `crates/mokly-model/src/usage_context.rs:76-81`. It saves 12.9 MB after view sharing.
- 2026-11-27: A detail format change ships in the same release window as the index change. Reason: the receiver gates only the index number. Without an index change, a detail from an older CLI reaches the app's viewer, which reads only the new number. When the answers change the detail without the index, the receiver also gates the detail number.
- 2026-11-27: The format milestones start after the bounded-memory pull request merges into `main`. Reason: both change `CatalogueAssembler`, the detail spool and `Inventory`. Compact JSON can merge before or after that pull request, because it changes only the encoder and the fixtures.
- 2026-11-28: The cloud build runner's floor, `MIN_MOKLY_VERSION`, rises only after the first release that writes index version 10, together with its recovery texts. Reason: the toolchain gate requires the workspace version to meet the floor, and versions advance only through the release pull request. The API's 426 text is the exception: it changes with the receiver, as item 8 proposes.
- 2026-11-28: Preview capture, the image smoke and the cloud script and infrastructure tests read one generated record of the versions that the cloud receiver accepts. Reason: each copies the index version by hand today, so capture would refuse the format pull request's own preview. These readers are all on AGPL paths.
- 2026-11-28: The index and detail fixtures get names without a format number, such as `catalogue.json` and `entry-details.json`. Reason: PRs #217, #223 and #224 each renamed them by hand, and a reader that a list misses then breaks. The Mokly release smoke, an MIT path, then needs no record that the AGPL contract crate writes.
- 2026-11-28: The shell model joins the moved fields onto each record with an `omitted` state until the route's detail holds them. Reason: Props must keep its loading line and **Try again** while the detail loads or fails, and the model already does the same for `usage`.
- 2026-11-28: Under option C or G of item 5, the fixture generator and the live smoke check the real `publish` output. A refused `publish` leaves it in its private directory. Reason: the two commands then write different outputs, and each check must prove the bytes of the command that it checks.
- 2026-11-27: The Mokly-owned HTML bytes stay out of this plan under the recommended answers. These are the marker `path` and `props` attributes, 34.2 MB, the frame probe templates, 32.6 MB, and the copies of collected style blocks, 43.2 MB. Reason: the ceilings of items 2 and 3 give room without them. Under option A or F of item 1 they become a milestone. The reason changed on 2026-11-28, because option D of item 2 names no target. Inline SVG stays the consumer's markup.
- 2026-11-27: Verification uses the workspace CLI against a local receiver before the merge, and the hosted cloud after the release. Reason: a released CLI does not exist until after the merge. On 2026-11-28 a one-time Plan-time proof at the target joined it. Each proof uses a fresh project and an unpublished head, so `missing` holds every declared digest except those of the Plan-archive files.

## Replaced Ways

Each milestone also searches for every other consumer of its old way, and it moves that consumer.

- Two-space canonical JSON → compact canonical JSON. Moved and deleted in Milestone 2. Consumers:
  - `crates/mokly-model/src/canonical.rs`, the marker writer in `output/artifact.rs` and the manifest writer in `output/upload.rs`.
  - The byte-level tests of `mokly-model`, `mokly-static`, `mokly-server` and `mokly-compare`, and `tests/helpers/static_identity.ts:32-49`, which recomputes ids from two-space JSON.
  - The cloud contract fixtures under `crates/mkc-mokly-contract/fixtures/`.
  - `docs/protocol/mokly-catalogue-serialization.md`.
- Declared bytes over every file → over each distinct digest, with a quota of its own. Moved and deleted in Milestone 3. Consumers:
  - `crates/mkc-mokly-contract/src/bundle_validation.rs:29-37` and `limits.rs`.
  - The test receiver under `tests/helpers/receiver/`.
  - `docs/protocol/cloud/publication-upload-validation.md`.
- Index records carry `propSchema`, `props` and `controls` → the detail carries them. Moved and deleted in Milestone 5. Consumers:
  - `crates/mokly-model/src/projection_records.rs`, the public index types and readers, `usage_schemas.rs` and `detail_context.rs`.
  - The base projections of `mokly-compare`.
  - The viewer's `control_values.ts`, `component_controls.tsx`, `component_controls_panel.tsx`, `component_control_fields.tsx`, `component_controls_state.ts`, `workspace_props.tsx`, `public_compared.ts` and `packages/viewer/src/catalogue/shell_model.ts`, and `packages/viewer/tests/props_empty_states.test.tsx:196-205`.
  - The reader fixtures under `docs/protocol/fixtures/`, the generated types, and `docs/protocol/mokly-component-controls.md`.
- Index version literals in the capture and smoke tools → one generated record of the receiver's versions. Moved and deleted in Milestone 5. Consumers:
  - `infra/scripts/catalogue_capture_plan.py:146-147` and `infra/scripts/smoke-images.py:43`.
  - `scripts/cloud/_tests_/build_upload_fixture_tests.py:38` and `scripts/cloud/_tests_/publication_smoke_fixture_tests.py:37`.
  - `infra/tests/catalogue_capture_support.py:156`, `infra/tests/test_catalogue_capture_receiver.py:32`, `infra/tests/test_catalogue_capture_plan.py:49-55` and `infra/tests/test_smoke_image_publication.py:19`.
  - The refused versions of `scripts/cloud/publication_smoke_uploads.py:100-106`.
- Fixture names with a format number → names without one. Moved and deleted in Milestone 5. Consumers: `scripts/release/smoke_browser.mjs:13`, `xtask/scripts/mokly-fixtures.mjs:105`, `xtask/scripts/mokly-fixture-artifacts.mjs:197`, the reason at `docs/protocol/mokly-format-versions.md:32-35`, and every other reader of the versioned names. A search on 2026-11-28 found 120 such files.
- One usage record for each view → a view of the encoded detail can name an earlier view's record. Moved and deleted in Milestone 6. Consumers:
  - The detail encoder that `build` and Serve share, and the Rust and viewer detail readers, which resolve each reference on decode.
  - The per-view writers stay unchanged: the build's `crates/mokly-static/src/assembly.rs:121`, `crates/mokly-compare/src/projection_removed.rs:99`, and Serve's `crates/mokly-server/src/evidence.rs` and `replacement.rs`.
  - The in-memory readers stay unchanged too: `crates/mokly-model/src/usage_context.rs`, `detail_validation.rs` and `projection_usage.rs`, and `crates/mokly-compare/src/projection_inputs.rs:35`.
- One `usedBy` or `affected` link for each instance and view → the shape of item 10. Moved and deleted in Milestone 6. Consumers:
  - `crates/mokly-model/src/projection_usage.rs` and Serve's `crates/mokly-server/src/changes_detail.rs`.
  - `crates/mokly-compare/src/projection_workspace.rs`, `projection_removed.rs` and `detail_validation.rs`.
  - The viewer's `workspace_usage.tsx`, `workspace_panel.tsx`, `public_workspace.ts` and `workspace_data.ts`, and `packages/viewer/tests/usage_rows.test.ts`.
- After snapshots of `mokly publish` → current documents for the after pane. Moved and deleted in Milestone 7. Consumers:
  - `crates/mokly-static/src/comparison_files.rs` and `comparison_output.rs`.
  - The viewer's pane loader, the browser specs of comparisons, and the cloud smoke `scripts/cloud/viewer_index_smoke.py:45-47`.
  - The fixture generator's `verifyExport` at `xtask/scripts/mokly-fixture-artifacts.mjs:57-74`, the live smoke's `_served_build` at `scripts/cloud/publication_smoke_cli.py:95-100`, `tests/static_changes_publication.test.ts:68-75` and `tests/static_publication_comparison.test.ts:77-107`.
  - `docs/protocol/cloud/mokly-fixture-regeneration.md:52-59`, `crates/mkc-mokly-contract/fixtures/README.md:53-54` and `docs/ops/publish-smoke.md:117-118`, which say that the upload equals the standalone build.
- Snapshots and resources of every view → those of the read views only. Moved and deleted in Milestone 7. Consumers: the same files.

## Implementation Order

The plan stays on this branch until the user answers and the rewrite below is done. Under the recommended answers, the work then reaches `main` in two implementation pull requests, as item 8 proposes. Each pull request opens only when its milestones are complete, as the user asked on 2026-11-28.

- The first implementation pull request carries Milestones 1 to 4. Milestones 2 and 3 can run in parallel workspaces after Milestone 1, because they change different files. If Milestone 3 changes a contract fixture, it merges after Milestone 2.
- The second implementation pull request starts from `main` after the first one merges, and after the bounded-memory pull request merges. Milestones 5, 6 and 7 run one after the other, because each changes the detail type and the fixtures. Milestones 8 and 9 close it.

A rule for each milestone that changes a Rust-owned shape or the producer output:

- Read the `shared-types` skill.
- Run `cargo xtask generate-types` after the shape change and before its TypeScript readers change. Delete each generated module that a rename leaves behind.
- Run `cargo xtask mokly-fixtures` after the producer change, and commit both outputs.
- End with `cargo xtask check-generated-types`, `cargo xtask mokly-fixtures --check` and the targeted tests.

After the user answers, and before Milestone 1 starts:

- The working agent rewrites the milestones for the chosen combination of answers. It keeps each TODO that an answer needs. It moves each shared TODO to a milestone that the answers keep. Such TODOs are the number raise, the generated types, the fixtures, the upgrade guide and the cutover. It rewrites each `Depends on:` line.
- When an answer adds a screen state or product copy, the plan gets a first mockup milestone and a tagged UI milestone. These options do so:
  - option G of item 2 and option E of item 3,
  - option F of item 5 and options C and F of item 7,
  - options F and I of item 8, and options B and E of item 10.
- Under option F, H or J of item 8, the rewrite adds the runner rule to the second implementation pull request. The rule comes with its tests, its recovery texts and its entry in Replaced Ways. Under option G or I, the rewrite adds the readers of the older formats and their tests.
- The working agent sets the pass conditions of Milestone 8 for the chosen target.
- Each pull request ends with a closing milestone. It runs the gate, the commit and the push, and the review, and then it opens the pull request. Each pull request except the last keeps this plan. The first milestone of each later pull request depends on the merge of the earlier one into `main`. It also depends on the release when the answer puts a release between them. The first commit of each later pull request writes its branch into the status line.
- A fresh plan review with the `implementation-review` skill checks the rewritten plan.

Under option A, C, E or F of item 7, one more question goes to the user. How do the screens read and the check render of a kept index 9 publication answer? The options are these:

- They keep failing, and each option of item 7 states it.
- `listScreens` answers 503 `operation-unavailable`, as for a current-only publication, and a rerequest gives the neutral check. Medium.
- The stored reads accept the old index version beside upload admission. Medium.
- Admission stores the screen and check facts apart from the index, and a backfill before the format change fills them for old publications. Large.

## Milestone 1: Documentation and protocol

Depends on: the user's answers and the rewrite in Implementation Order

Write the chosen requirements before any code changes. Each page whose behaviour waits gets a status line that links the milestone heading that builds it.

- [ ] Read the `documentation` skill.
- [ ] State the compact canonical form and the answer to item 11 in `docs/protocol/mokly-catalogue-serialization.md` and `docs/protocol/mokly-export-delivery.md`.
- [ ] State the counting rule and the ceilings of item 3 in `docs/protocol/cloud/publication-upload-validation.md`, `docs/protocol/mokly-upload-validation.md` and `docs/protocol/mokly-export-ownership.md:118`. State the lower limits of preview capture in `docs/protocol/cloud/preview-capture.md`. Rewrite the marker sentence at `docs/protocol/cloud/publication-upload-validation.md:39-42` for the separate file and marker bounds. Update the memory budget of `docs/ops/environment.md`.
- [ ] Add the HTTP 426 row for an unsupported index version to `docs/protocol/mokly-upload-validation.md`, as option D of `plans/follow-ups/upload-plan-index-version-status.md` says. Delete that item.
- [ ] State index version 10 and entry detail version 5 in `docs/protocol/mokly-format-versions.md` and `docs/protocol/cloud/mokly-artifact-compatibility.md`. State the answer to item 8 beside the release rule of that page.
- [ ] Replace the decision in force of `docs/protocol/mokly-shell-delivery.md:42-44`, which chose compression over a smaller index format. Give the answer to item 4 and its reason.
- [ ] State the index records and the detail fields of item 4 in `docs/protocol/mokly-catalogue.md`, `docs/protocol/mokly-shell-delivery.md` and `docs/protocol/mokly-component-controls.md`. Lines 26 and 42 of the last page put the fields in the index.
- [ ] State the shared view records, the omitted `source` and the answer to item 10 in `docs/protocol/mokly-component-usage-records.md`, `docs/protocol/mokly-shell-delivery.md` and `docs/protocol/mokly-live-evidence.md`.
- [ ] State the snapshot rules of item 5 in `docs/protocol/mokly-changes-serving.md`, `mokly-export-delivery.md`, `mokly-comparison-panes.md`, `mokly-artifact-paths.md`, `mokly-comparison-serving.md`, `mokly-selected-comparisons.md` and `docs/protocol/cloud/catalogue-hosting.md`. Under option C, state the receiver rule of an immutable origin in `docs/protocol/mokly-upload-exchange.md`.
- [ ] State in `docs/protocol/cloud/cloud-build-runner.md` that the floor keeps its value until the first index 10 release ships.
- [ ] State the answer to item 6 in `docs/protocol/cloud/mokly-fixture-regeneration.md` and `docs/ops/publish-smoke.md`. Under option C or G of item 5, also state there and in `crates/mkc-mokly-contract/fixtures/README.md` that the checks read the real `publish` output.
- [ ] Under options A to D and F of item 8, state the new 426 text in `docs/protocol/cloud/rest-api-surface.md:147`, with a status line.
- [ ] Under option F, H or J of item 8, state the runner rule in `docs/protocol/cloud/cloud-build-runner.md`. Under option G or I, state in `docs/protocol/cloud/mokly-artifact-compatibility.md` which older formats the cloud keeps reading. Under option I or option C of item 7, also state in `docs/protocol/cloud/viewer-host.md` that an older publication opens in its own shell.
- [ ] Change the reason at `docs/protocol/mokly-format-versions.md:32-35` that each raise renames the fixtures. The decision there keeps its choice.
- [ ] Add the cutover of item 7 to `docs/ops/mokly-release-cutover.md`. Its publish proof needs the first release that writes index version 10.
- [ ] Update every other protocol page that names index version 9 or entry detail version 4, each with a status line. A search on 2026-11-27 found 30 pages and READMEs that name them. The READMEs and the user guides change with the code in Milestones 5 to 7.
- [ ] Update each follow-up item that names a decision or a section that this milestone changes, as the `plans` skill says. Start with `compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md`, `snapshot-resource-copies.md`, `skip-equal-before-snapshots.md`, `embedded-document-closures.md`, `upload-quotas-not-revisited.md`, `runner-reports-missing-native-package-as-old-mokly.md` and `own-mokly-check-runs-unbuilt-workspace-cli.md`.
- [ ] Keep each protocol doc within its cap. `docs/protocol/mokly-shell-delivery.md` has 245 of its 250 lines, so split it when it grows.
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Compact canonical JSON

Depends on: 1

Every JSON file of the output loses its indentation. No format number changes. Expected saving for conductive: about 860 MB. The details fall from 1,246.2 to 414.2 MB, the index from 48.7 to 20.8 MB, and the marker from 2.27 to 1.89 MB.

- [ ] Read the `rust` and `testing` skills.
- [ ] Encode compact JSON in `crates/mokly-model/src/canonical.rs`. Keep the key order, the number spelling and the final LF.
- [ ] Write the marker and the upload manifest in the same form.
- [ ] Hash the bytes that the answer to item 11 names for each detail id.
- [ ] Update each test that pins pretty bytes, and `tests/helpers/static_identity.ts:32-49`. Add a regression test that a canonical document has no whitespace between its tokens.
- [ ] Give `crates/mkc-mokly-contract/src/_tests_/json_numbers_tests.rs` explicit JSON input with the required number spellings, such as `3e0` and `9.0`. Its envelope case asserts `schema_version` 3 and `pull_request` `Some(2)`. Show that each case fails when the reader refuses a spelling.
- [ ] Run `cargo xtask mokly-fixtures`, and commit its output.
- [ ] Build `examples/basic` and conductive, and record their sizes under `.context/large-catalogue-publication/`.
- [ ] Delete `plans/follow-ups/compact-json-output.md`.
- [ ] Run `cargo xtask check --suite repository` and the targeted tests of the changed crates.

## Milestone 3: Receiver quotas

Depends on: 1

The receiver counts each distinct file once, and each ceiling follows the target of item 2. No file gets smaller. The counted bytes of conductive fall by 56.7 MB today, because 3,147 files repeat another file.

- [ ] Read the `rust` and `testing` skills.
- [ ] Under option D, F or G of item 2, run the synthetic measurement first, and set each ceiling 25% below its measured safe bound. Add to `plans/follow-ups/receiver-read-model-validation.md` that its check of every entry detail must measure the bounds again.
- [ ] Sum the declared bytes over distinct digests in `crates/mkc-mokly-contract/src/bundle_validation.rs`.
- [ ] Give the declared-bytes quota its own number in `limits.rs`. Today the check reuses the plan-archive quota, `limits.decompressed()`.
- [ ] Set the ceilings of item 3 in `limits.rs` and the JSON node budgets in `json_guard.rs`. Derive the prefix quota and the marker byte quota from the file ceiling, and cap the marker quota at the 64 MiB file ceiling.
- [ ] Give the plan-archive scan of `crates/mkc-mokly-contract/src/tar_scan.rs:173` its own member count, apart from the file ceiling.
- [ ] Set the file ceiling in `crates/mokly-model/src/output/validation.rs`, and check that `mokly publish` applies it.
- [ ] Update the test receiver under `tests/helpers/receiver/`, the case at `scripts/cloud/publication_smoke_uploads.py:79-82`, and the allocation limit at `crates/mkc-mokly-contract/tests/memory.rs:56`.
- [ ] Keep the lower limits of preview capture at `infra/scripts/catalogue_capture_plan.py:17-18`.
- [ ] Add a regression test for each new bound, and one that a repeated file counts once.
- [ ] Measure the API with a synthetic upload at the new bounds, with conductive's nested path layout. It passes when the API stays within its 1 GiB limit and the upload ends within 60 minutes.
- [ ] Run the bounded case of the one-time Plan-time proof. It isolates the file, prefix and marker limits from the byte limit.
  - Scale today's conductive paths, without the after side, to the target with 25% room. Give each copied file its own digest and a small declared size.
  - Declare `mokly-upload.json`, and give the stand-in index the base commit and the comparison generation of the marker.
  - Use a fresh project and an unpublished head. Then `missing` must hold every declared digest except those of the Plan-archive files.
  - Record the first larger copy that the receiver refuses, and which limit refused it.
- [ ] Record the results under `.context/large-catalogue-publication/`.
- [ ] Delete `plans/follow-ups/upload-quotas-not-revisited.md`.

## Milestone 4: First implementation pull request

Depends on: 1, 2 and 3

This milestone closes the first implementation pull request.

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Keep this plan, because the work spans two pull requests.
- [ ] Record a follow-up item for each problem outside the scope that the reviews of 2026-11-27 and 2026-11-28 found. The review folder of the plan branch lists them. The first is this one. The CLI reads no rejection body, and the API gives every `TooLarge` refusal one reason, so an HTTP 413 answer names no limit.
- [ ] Open the first implementation pull request into `main`. Its description gives the decisions, the design calls and their dates. The user merges it.

## Milestone 5: Entry fields leave the index

Depends on: 4, the merge of the first implementation pull request into `main`, and the merge of the bounded-memory pull request into `main`

Index version 10 and entry detail version 5 start here. Each detail of a screen or a component carries its prop schema, its saved props and its controls. Expected result for conductive: the index falls from 20.8 MB and 2,162,642 nodes to 2.85 MB and 150,688 nodes. The details grow by about 18 MB, so the total stays about the same.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Raise the numbers in `crates/mokly-model/src/versions.rs`, the `ts` attributes at `crates/mokly-model/src/public_index.rs:125` and `public_detail.rs:142`, and the viewer gates at `packages/viewer/src/catalogue/index_reader.ts:11` and `detail_reader.ts:11`.
- [ ] Move the fields from `crates/mokly-model/src/projection_records.rs` into the detail projection.
- [ ] Read the component schemas from the component details in `usage_schemas.rs` and `detail_context.rs`. Update the strict and the lenient readers.
- [ ] Update the base projections of `mokly-compare` and each Serve route that reads the fields.
- [ ] Run `cargo xtask generate-types`. Then read the control target from the detail in the viewer, and move each viewer consumer of the old fields.
- [ ] Join the moved fields onto each record in `packages/viewer/src/catalogue/shell_model.ts`, with an `omitted` state until the detail holds them. Props then shows its loading line and **Try again** for a screen with saved props. Add a case where such a detail loads and then fails, and change the rule of `packages/viewer/tests/props_empty_states.test.tsx:196-205`.
- [ ] Accept only index version 10 in `crates/mkc-mokly-contract/src/index.rs`, and update its tests and its corpus.
- [ ] Give preview capture, the image smoke, and the cloud script and infrastructure tests one generated record of the versions that the cloud receiver accepts. Write it from the contract crate, and move the version checks of the Replaced Ways list to it.
- [ ] Apply the answer to item 6 to the published-package smoke at `scripts/cloud/publication_smoke_cli.py:74-79`.
- [ ] Under options A to D and F of item 8, change the 426 text with the receiver at `crates/mkc-api/src/upload_error.rs:23` and `crates/mkc-api/README.md:159`. Change its tests at `crates/mkc-api/src/_tests_/upload/plan_tests.rs:162` and `scripts/cloud/publication_smoke_uploads.py:76` and `:105`.
- [ ] Give the index and detail fixtures names without a format number, such as `catalogue.json` and `entry-details.json`. Move each reader of the old names once, also `scripts/release/smoke_browser.mjs:13`, `xtask/scripts/mokly-fixtures.mjs:105` and `xtask/scripts/mokly-fixture-artifacts.mjs:197`. Rewrite the reader fixtures under `docs/protocol/fixtures/`. Run `cargo xtask mokly-fixtures`.
- [ ] Search for every other consumer of the old fields and the old numbers, and move it.
- [ ] Update each README that names index version 9 or entry detail version 4.
- [ ] Measure the index of conductive: its bytes and its nodes.
- [ ] Delete `plans/follow-ups/variant-prop-schema-copies.md`.
- [ ] End with the checks of the rule in Implementation Order.

## Milestone 6: Usage records written once

Depends on: 5

Expected saving for conductive under option D of item 10: about 264 MB. The details fall from about 432.2 to about 168.2 MB. Under option F they fall to about 220.2 MB.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Write the omitted `source` in the detail projection, and keep instance props inline.
- [ ] Write the view references in the detail encoder that `build` and Serve share. It names the earliest equal ready view. Resolve each reference in the Rust and viewer detail readers when they decode a detail, so that each in-memory view keeps its own `CatalogueUsage`.
- [ ] Add one round-trip test in Rust and one in TypeScript. In each, the first view differs from the second, and a later view names the second. Assert the exact resolved record of each view.
- [ ] Write the usage lists that item 10 chooses, in `projection_usage.rs` and Serve's `changes_detail.rs`. Write the same shape for `affected` and for removed entries in `crates/mokly-compare/src/projection_workspace.rs` and `projection_removed.rs`.
- [ ] Check the new shapes in `usage_context.rs`, `detail_validation.rs` and the lenient readers.
- [ ] Run `cargo xtask generate-types`. The render answer, the frame adapters and inspection keep reading `CatalogueUsage`.
- [ ] Move the usage rows of `workspace_usage.tsx` and `workspace_panel.tsx` to the chosen list shape. Move the assertion of mixed eligibility at `packages/viewer/tests/usage_rows.test.ts:88` with them.
- [ ] Run `cargo xtask mokly-fixtures`, and update the reader fixtures.
- [ ] Measure the details of conductive.
- [ ] End with the checks of the rule in Implementation Order.

## Milestone 7: Snapshots only where a reader opens them

Depends on: 6

A current-only build does not change. Expected saving for conductive: a pull request without a comparable view or a removed entry writes none of the 15,040 snapshot files, 823.5 MB. A pull request that changes every view writes about 7,520 before files, about 412 MB, and no after files in Mokly Cloud.

- [ ] Read the `rust`, `typescript`, `testing` and `deterministic-tests` skills.
- [ ] For each side that the answer to item 5 keeps, write the documents of comparable and removed entries. Also write each catalogue document that a kept document embeds, transitively. Use one embed walk with `crates/mokly-compare/src/css_documents.rs:51-87`.
- [ ] Write only the resources of the kept documents. Keep the viewer-face copies of `crates/mokly-static/src/comparison_output.rs:88-98`.
- [ ] Under option C of item 5, let `mokly publish` write no after side, and let `mokly build` keep it. Add the index field that tells the viewer where the after pane reads.
- [ ] Load the after pane from the current document where the index says so, in the viewer. Keep Serve's captured after side.
- [ ] Test an empty selection and a nested embed with a fixture, because conductive has no embed.
- [ ] Update the cloud smoke at `scripts/cloud/viewer_index_smoke.py:45-47`, which expects after files.
- [ ] Under option C or G of item 5, capture the real `publish` output. A refused `publish` keeps it in its private directory, as `planReceiver(426)` in `xtask/scripts/mokly-fixture-upload.mjs` already allows. Feed it to `verifyExport` in `xtask/scripts/mokly-fixture-artifacts.mjs` and to `_served_build` in `scripts/cloud/publication_smoke_cli.py`. Move `tests/static_changes_publication.test.ts:68-75` and `tests/static_publication_comparison.test.ts:77-107` with them. The build tests keep checking the after side of `mokly build`.
- [ ] Run each changed browser spec of comparisons 10 times, and record the pass count.
- [ ] Run `cargo xtask generate-types` and `cargo xtask mokly-fixtures`.
- [ ] Delete `plans/follow-ups/unread-comparison-snapshots.md` and `snapshot-resource-copies.md`. Narrow `skip-equal-before-snapshots.md` to the equal before documents of comparable entries. Update `embedded-document-closures.md`, whose lines 42-44 describe static comparisons.
- [ ] Add the upgrade section for index version 10 and entry detail version 5 to `docs/guides/start/upgrade.md`, with the `external docs implementor` action. It covers Milestones 5 to 7.
- [ ] End with the checks of the rule in Implementation Order.

## Milestone 8: Large catalogue verification

Depends on: 7

Conductive is the large example catalogue. No change goes to its repository, and the local commit below stays in a scratch clone under `.context/`.

- [ ] Build conductive at `3371d05f` with the workspace CLI, current-only, and record the output.
- [ ] Add one local commit that changes `components/common/icon-button` and the wrapper of conductive's renderer, `docs/mockups/src/render.tsx`, so that every view gets a before pane. Build it with Changes against its parent.
- [ ] Publish each case cold to a fresh project of a local receiver, as the interactive local procedure of `docs/ops/publish-smoke.md` says. Measure the `publish` output that the capture of Milestone 7 keeps, not the standalone builds.
- [ ] Require a before pane for every view of the published index. Require a marker entry for each pane document, and a successful load of each pane file.
- [ ] Run the target case of the one-time Plan-time proof on the captured `publish` output. Scale its marker and its index to the ceilings that the answer to item 2 sets, with a fresh project and an unpublished head. `missing` must hold every declared digest except those of the Plan-archive files. Record the first larger copy that the receiver refuses.
- [ ] Give the answer to item 2 its own acceptance case. Under its option E, add a pull request that removes every entry.
- [ ] Under option B of item 9, require the pull-request build to finish within the 30-minute attempt deadline on the bigger template.
- [ ] Record the declared and the distinct bytes, the files, the prefixes, the index bytes and nodes, the build time and the peak RSS. Compare them with the ceilings of item 2.
- [ ] Open both catalogues in the viewer. Check Browse, the Props panel, Used by and each comparison mode. Save screenshots under `.context/large-catalogue-publication/`.

## Milestone 9: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Dispatch `.github/workflows/release-check.yml` on the branch once, and fix each failure. It runs the release smoke that the gate never runs.
- [ ] Under options A to D and F of item 8, check that no release came out after the release that the 426 text names.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan".
- [ ] Open the pull request. Its description gives the decisions and the design calls of this plan with their dates. It also gives a permalink to this plan and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Release the format changes. The user merges the release pull request.
- [ ] Raise `MIN_MOKLY_VERSION` in `crates/mkc-build-sandbox/src/versions.rs` to that release. Update its recovery texts with it, and their tests:
  - `packages/app/src/viewer/build-copy.ts:31` and `docs/mockups/src/fixtures/build-copy.ts:15`.
  - `crates/mkc-publications/src/build_check_summary.rs:170`.
  - `docs/protocol/cloud/viewer-builds.md:60`, `changes-check-builds.md:45` and `cloud-build-runner.md:134`.
  - `apps/site/src/content/docs/cloud/builds.md:47`, `docs/development/cloud.md:28` and `docs/ops/build-template.md:259`.
  - `crates/mkc-build-sandbox/README.md:29` and `crates/mkc-publications/README.md:161`.
- [ ] Run the cutover of item 7 in each stable environment.
- [ ] Record the capture again with `infra/scripts/record-catalogue-capture.py`, against the first release that writes index version 10.
- [ ] Publish a push and a pull request of conductive through the cloud build on the bigger template, and record the result. This plan makes no change in conductive's repository. Under option F or G of item 8, conductive needs no upgrade. Under the other options, it takes the new release as any project does.
