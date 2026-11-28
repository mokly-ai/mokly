# Large Catalogue Publication

Status: Active. On branch `calummoore/catalogue-size-plan-to-fit-the-upload-pjqr`, no pull request yet. Every decision of this plan waits for the user, and no implementation is approved. The plan-only pull request keeps this plan. The last implementation pull request deletes it, as the `plans` skill says.

Mokly Cloud refuses the catalogue of a large project. On 2026-11-27, the repository `Firna-AI/conductive` at commit `3371d05f` built with `@mokly/mokly` 0.21.0 into 1,746 MB in 11,030 files. The receiver accepts 512 MiB, about 537 MB, of declared bytes. The index was 48.7 MB with 2,162,642 JSON nodes, and the receiver accepts 8 MiB and 262,144 nodes. A pull-request build wrote 26,070 files, above the ceiling of 20,000, because it copies every document two more times. Conductive had 72 entry files on 2026-11-08 and 664 on 2026-11-27.

This plan proposes two changes together. Mokly writes less in four steps: compact canonical JSON, entry fields out of the index, usage records written once, and fewer snapshots. The cloud counts each stored file once, and it sizes its quotas for a growth target. Every recommendation below is a proposal of 2026-11-27 or 2026-11-28, not a choice.

The plan does not change the build template, the attempt deadline, or the memory of the native process. The workspaces "Build capacity: bigger template and deadline" and "Build capacity: bounded render memory" own them. The plan does not render both colour schemes from one document.

On 2026-11-27 the workspace "conductivity build issue" gave the user its item 1 with three options:

- A. Raise the receiver limits.
- B. Make the output smaller in Mokly, with compact JSON and bounded or deduplicated usage records.
- C. Conductive cuts its catalogue.

The user asked for a brainstorm of item 1, and then for this plan. The parent workspace read that as option B. This plan keeps the root question open as item 1, because the brainstorm found more approaches.

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

After the recommended Mokly milestones, the current-only output of conductive is about 622.0 MB as declared and 565.4 MB as distinct files. The HTML is 395.7 MB of that. So each entry costs about 0.36 MB as declared, 0.33 MB as distinct files, 6.4 files, 9.0 path prefixes and 88 index nodes. A pull-request index costs about 109 nodes and 1,844 bytes for each entry. Under option C of item 5, a pull request that changes every view adds the before side. That side costs about 0.24 MB, 4.4 files and 5.7 path prefixes for each entry.

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

1. Each project publishes one catalogue. Source: the cloud keys a publication by project, head and config path in `docs/protocol/cloud/publication-upload.md`. Option D of item 1 drops it, because conductive then publishes several catalogues.
2. The static output stays complete, and its host runs nothing. Source: `docs/protocol/mokly-export-delivery.md`, Hosting Contract. Every option keeps it.
3. Each view keeps its own document. Source: the renderer receives the colour scheme under `docs/protocol/mokly-rendering.md`, and the measurement shows 0 equal pairs. Every option keeps it.
4. A format number changes only with a change of shape or meaning, and at most once in a release window. Source: `docs/protocol/mokly-format-versions.md`. Every option keeps it.
5. A format change replaces every reader of the old format in the same change, and the cloud converts no stored publication. Source: `docs/protocol/cloud/mokly-artifact-compatibility.md`, Mokly Changes. Option E of item 8 drops the first part, and option G of item 7 drops the second.
6. The receiver quotas stay as they are. Source: the requirements of `docs/protocol/cloud/publication-upload-validation.md:20-42`, and `crates/mkc-mokly-contract/src/limits.rs:33-48`. Their reason is gone: they came from an API whose memory grew with the whole export, as `plans/follow-ups/upload-quotas-not-revisited.md` records. Options B, C and E of item 1 drop it.
7. Every build publishes every view of each entry, four for each conductive entry. Source: `docs/protocol/mokly-component-usage-records.md`, Validation. Option D of item 1 drops it.
8. A publication that is above one limit fails as a whole. Source: `docs/protocol/mokly-upload-validation.md`, Rejections, and `crates/mokly-publish/src/snapshot.rs:77-84`. Option F of item 5 drops it for the comparison, at the CLI's file ceiling only.

## Decisions

Implementation starts only after the user answers items 1 to 11. Answer each item by its number and letter. Items 6, 7 and 10 come from the plan review of 2026-11-28.

| #   | Item                                             | Source | Severity | Effort | Recommended                                                    |
| --- | ------------------------------------------------ | ------ | -------- | ------ | -------------------------------------------------------------- |
| 1   | A large catalogue cannot publish                 | Design | High     | Large  | C: Mokly writes less, and the cloud resizes its quotas         |
| 2   | No size target for one publication               | Design | High     | Medium | B: about 3,500 entries for every build                         |
| 3   | The receiver counts copies and caps growth       | Design | High     | Medium | C: count each file once, and set ceilings for the target       |
| 4   | The index carries each entry's controls          | Design | High     | Large  | B: each detail carries its own                                 |
| 5   | Pull-request builds copy every document twice    | Design | High     | Large  | C: read snapshots only, and no after side in Mokly Cloud       |
| 6   | The required smoke blocks the format change      | Review | High     | Medium | D: the smoke chooses its producer by format                    |
| 7   | Old publications break at the cutover            | Review | High     | Small  | D: reset each stable environment, as at the 0.18 cutover       |
| 8   | A format change breaks the cloud until a release | Design | Medium   | Small  | B: two pull requests                                           |
| 9   | No build time target                             | Design | Medium   | Small  | A: no target, and measure only                                 |
| 10  | Usage lists repeat each consumer                 | Review | Medium   | Small  | D: one row for each consumer group that the viewer shows today |
| 11  | Compact JSON changes every detail id             | Design | Low      | Small  | A: the ids hash the compact bytes                              |

### 1. A large catalogue cannot publish

- **Severity:** High. **Likelihood:** Common. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mkc-mokly-contract/src/bundle_validation.rs:29-37`, `crates/mkc-mokly-contract/src/json_guard.rs:16`, `crates/mokly-model/src/canonical.rs:42-57` and `crates/mokly-static/src/comparison_files.rs:32-68`.
- **Background:** `mokly publish` builds the static output, and it uploads each file that the project lacks. The receiver checks the declared catalogue before any file arrives. It accepts 512 MiB of declared bytes, 19,999 marker entries, 65,536 path prefixes, an 8 MiB index and 262,144 JSON nodes in the index. The CLI refuses more than 20,000 files before any request.
- **Problem:** Conductive is above four of these limits. Its declared bytes are 1,746 MB. Its index is 48.7 MB with 2,162,642 nodes. Its pull-request build has 26,070 files and 2,580.5 MB.
- **Impact if no action:** Conductive never publishes. Each other large catalogue meets the same limits.
- **Root question:** How does a large and growing catalogue publish within the cloud's limits?
- **Shared assumptions:** The plan-wide assumptions. Option D drops assumptions 1 and 7. Option F of item 5 drops assumption 8 for the comparison.
- **Options:**
  - **A.** Mokly writes less, and the quotas stay. This needs every Mokly milestone of this plan, option C of item 4 and the HTML work of the design calls. Conductive's current-only build then lands near 452 MB. It fails again near 2,050 entries, and a pull request that changes every view still fails. Effort: Large.
  - **B.** Mokly takes only compact JSON, and the cloud changes its quotas. The cloud counts each stored file once, and it raises each ceiling until conductive fits. The viewer still fetches a 20.8 MB index at each page load, and each build still writes about 0.89 GB. Effort: Medium.
  - **C.** Both. Mokly writes less where the viewer and the build gain. The cloud counts each stored file once, and it sizes its quotas for the target of item 2. Effort: Large.
  - **D.** Conductive splits its catalogue into several configurations, or it renders fewer views. Mokly does not change. One catalogue becomes several, and the limits fail again as each part grows. Effort: Medium.
  - **E.** C, and the index splits into a navigation index and one record file for each folder. The navigation index keeps every fact that the cloud reads. These are the base fields, each record's path, title, `previousPath` and `changes`, and each current screen's view axes. It also keeps the tags, the detail id and the variant parent. On conductive it is 0.74 MB with 60,986 nodes, 35 for each entry. It stays under 262,144 nodes up to about 7,400 entries, or 6,600 for a pull-request build. It reaches 10,000 entries only with the 524,288 nodes of option C of item 3. It changes the index format, the viewer's loading and the receiver's index reader. The options check of 2026-11-27 added it. Effort: Large.
- **Left out:**
  - Compress only the upload. The quotas count decoded bytes.
  - One document for both colour schemes. The renderer writes different inline colours for each scheme, and 0 of 3,442 pairs are equal after the scheme marker.
  - The viewer computes `usedBy` itself. It needs every detail, 414 MB as compact JSON.
  - Data from a server at view time. The static host runs nothing, under assumption 2.
  - Upload only the changed files. The exchange already does it, and the quotas count the whole declared catalogue.
  - A size warning in `mokly build`. A receiver can set quotas below the Mokly ceilings, and the CLI does not know them.
- **Wider fix:** C. It removes the copies at their source, and it gives the quotas room for growth.
- **Previous examples:** Item 1 of the workspace "conductivity build issue" on 2026-11-27. The items `plans/follow-ups/compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md` and `upload-quotas-not-revisited.md` hold parts of the same problem.
- **Related:** Items 2 to 5 and item 10, work that waits for the answer. Item 3 applies only under B, C and E. Option E also answers item 4.
- **Recommendation:** C. The Mokly changes make the index and the details fast to load and to build, and only a quota change leaves room for growth. E matters only under option C of item 2, or when growth is faster.
- **Action:** ask the user, because A, B, C and E change requirements in force, and D moves the work to conductive.

### 2. No size target for one publication

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `docs/protocol/cloud/publication-upload-validation.md:20-36`.
- **Background:** Each limit binds at a different catalogue size. After the recommended Mokly milestones, a conductive entry costs about 0.33 MB, 6.4 files, 9.0 path prefixes and 88 index nodes in a current-only build. Under option C of item 5, a pull request that changes every view adds more. It adds about 0.24 MB, 4.4 files and 5.7 path prefixes for each entry. Conductive has 1,721 entries. It grew from 72 to 664 entry files in 19 days, so it doubled about every six days.
- **Problem:** The plan cannot size the quotas, or decide the optional work, without a target.
- **Impact if no action:** The limits fail again soon after the change, or the cloud accepts much more than it needs.
- **Root question:** How large a catalogue must one publication hold, and for which builds?
- **Shared assumptions:** A target in entries becomes ceilings through conductive's cost for each entry. That holds only for catalogues like conductive, with four views for each entry and few public files. Option D drops it. One target serves every project. Option E of item 3 drops it.
- **Options:**
  - **A.** Conductive today with 25% room: about 2,150 entries, for current-only builds and pull requests that change few views. It needs a byte ceiling near 1 GiB of distinct files. A pull request that changes a widely used component can still fail. Effort: Small.
  - **B.** Twice conductive today: about 3,500 entries for every build, also a pull request that changes every view. It needs the ceilings of option C of item 3. Effort: Medium.
  - **C.** About 10,000 entries for every build. It needs ceilings about three times those of B. The pull-request index of such a catalogue is about 18 MB, and every page load fetches it. Effort: Large.
  - **D.** No catalogue size. Measure the API memory, the ingest time and the database rows with a synthetic upload. Set each ceiling 25% below the measured safe bound, and report the entry count that fits. The ceilings can then be far above any real need, so one upload can use a lot of storage. The options check of 2026-11-27 added it. Effort: Medium.
- **Left out:** None. The options check of 2026-11-27 brought back the approach without a target as D.
- **Wider fix:** None. A target is a policy, not a fix.
- **Previous examples:** Option B of `plans/follow-ups/upload-quotas-not-revisited.md` proposed the measurement of D.
- **Related:** Item 3 takes its ceilings from this answer. Item 5 needs option C or a later option under B or C here.
- **Recommendation:** B. A 3,500-entry pull-request index stays near 6.5 MB, below the 8 MiB quota, and B covers a pull request that changes every view. At the growth rate of November, twice today lasts about a week, so the user's view of growth decides between B and C.
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
    - A prefix quota of three for each file, 150,000, and a marker byte quota that also follows the file ceiling.
    - A plan-archive member count of its own, apart from the file ceiling.

    The CLI file ceiling changes too. Measure the API memory, the record count and the ingest at the new bounds, with conductive's nested path layout. Effort: Medium.

  - **D.** Count the gzip size of each distinct file, and store and serve gzip blobs. Today's conductive output is 188.6 MB this way. The marker declares only decoded sizes. So D also needs encoded sizes in the marker, which takes marker version 4, or a check after the Blobs. It does not change the file, prefix or index limits. Effort: Large.
  - **E.** A Team workspace gets the ceilings of C, and a free workspace keeps today's quotas. The receiver already gates an upload on the workspace plan, under `docs/protocol/cloud/billing-plan-gates.md`. It is a pricing choice, an environment without billing needs a default, and a refused free upload needs product copy. The options check of 2026-11-27 added it. Effort: Large.
- **Left out:**
  - Count only the bytes that one upload adds. The first publication of a project adds every byte, so a ceiling for the whole catalogue stays.
  - Remove the quotas. A bound keeps one upload from using up storage and time.
  - Remove the prefix quota. 50,000 files of 64 segments allow 3.2 million prefixes, far above the memory bound of the upload API.
  - Count each distinct file once in the file limit. Each path costs a database row and a marker entry, whatever its digest.
- **Wider fix:** C. Each ceiling then follows a stated target, the prefix and marker quotas follow the file ceiling, and duplicates never count.
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
- **Root question:** Where do an entry's prop schema, saved props and controls live, so that page loads stay small and the receiver accepts the index?
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
- **Related:** Item 1: option E also splits the index. Item 3: option D needs higher index quotas there. Item 8: A, B and C need index version 10 and entry detail version 5.
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
- **Shared assumptions:** A publication that is above one limit fails as a whole. Option F drops it. The output holds each pane document under the generation. B narrows it, C, G and H drop it for the after side, and D drops it. Snapshot bytes are the composed documents. E drops it.
- **Options:**
  - **A.** Keep both full sides. Effort: Small.
  - **B.** Write snapshots only for the views of comparable entries, for removed entries, and for each document that a kept document embeds. Write only the resources of the kept documents. This is option C of `plans/follow-ups/unread-comparison-snapshots.md`. A pull request that changes every view still writes both sides. Effort: Medium.
  - **C.** B, and `mokly publish` writes no after side. The upload exchange then requires a receiver to keep each publication at an origin whose files never change. Mokly Cloud already does. The after pane then reads the current document. `mokly build` keeps the captured after side for generic hosts, and Serve keeps its own. The plan review of 2026-11-28 narrowed C to these hosts. Effort: Large.
  - **D.** The cloud builds a large pull request current-only. Its check and its viewer then show no Changes. Effort: Small.
  - **E.** A static build keeps the frame probe in each snapshot document. An after snapshot then equals its current document, and an unchanged before snapshot has the same bytes. The distinct count of item 3 and the blob store keep each such file once. The file count and the path prefixes still double, so the prefix quota of 65,536 holds only about 3,200 entries. The options check of 2026-11-27 added it. Effort: Medium.
  - **F.** When a pull-request build would be above the CLI's file ceiling, the build drops the pane documents, publishes, and warns. The index and the details keep Changes, so the check runs, and the viewer shows each comparison as unavailable.
    - F recovers only from the file ceiling, which the CLI checks. The rest of the catalogue must still meet every receiver quota.
    - A trigger that sees more limits costs more. Examples are one re-plan without panes after an HTTP 413, or a receiver that states its limits before the build. Under option E of item 3, the CLI does not know the quotas of a free workspace.
    - A ready publication without panes wins every later upload of its commit.
    - It needs a format field, a viewer state with its copy, and a mockup. The options check of 2026-11-27 added it. Effort: Large.
  - **G.** C, and the rule that the user chose on 2026-10-27. The build writes no before document that equals its after document, and the before pane reads the current document. The five open decisions of `plans/follow-ups/skip-equal-before-snapshots.md` come with it. The options check of 2026-11-27 brought it back. Effort: Large.
  - **H.** B, and current HTML and its local files get immutable addresses that Browse and the after pane both read, on every host. It changes the address of every view and each reader of `static/mokly-generated/`. The plan review of 2026-11-28 added it. Effort: Large.
  - **I.** C on every host, and the viewer accepts an after document only when its SHA-256 equals the digest that the build records for that view. A host that rewrites HTML then loses its comparisons. The plan review of 2026-11-28 added it. Effort: Large.
- **Left out:**
  - A before pane that reads the base commit's own publication. The output must stay complete, and a merge base can have no publication.
  - A snapshot store by content inside the output. The viewer cannot rewrite addresses inside stylesheets, and the receiver already stores each digest once.
  - A second deployment check after the pane's HTML arrives. Its later resource requests still fall outside the check.
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
- **Related:** Item 8: its option E removes this problem, and its other options need an answer here. Item 7: E keeps index 9 publications in the window.
- **Recommendation:** D. It ends the block at this and every later format change, and the newest release stays in the required smoke on every commit. B protects the package contents best before the release.
- **Action:** ask the user, because D changes the rule that the required smoke publishes with the newest npm release, which the user chose on 2026-11-19.

### 7. Old publications break at the cutover

- **Severity:** High. **Effort:** Small.
- **Source:** Review.
- **Category:** Docs or spec.
- **Location:** `crates/mkc-publications/src/reservation/reserve.rs:68-83`, `docs/protocol/cloud/viewer-host.md:100-124` and `docs/ops/deploy.md:800-803`.
- **Background:** A ready publication wins every later upload of the same project, commit and config path. The new app viewer reads only the new formats. The 0.18 cutover reset each stable environment, as the user chose on 2026-10-26. The cloud converts no stored publication.
- **Problem:** After the change, each ready publication from before the cutover shows the viewer's version error. A new upload of the same commit returns that old publication. The screens read and the check render of a kept index 9 publication also fail.
- **Impact if no action:** A project can republish, get a success result, and still see a catalogue that the viewer cannot open.
- **Root question:** What happens to the projects, the stored publications and their links when a format change leaves the cloud unable to read the stored catalogues?
- **Options:**
  - **A.** Keep old publications as history, and publish a new commit for each active branch. Document what old links show. The screens read and the check render of old publications still fail. Effort: Medium.
  - **B.** Expire the incompatible ready publications in a controlled cutover, and republish their commits. It changes retention and the old addresses. Effort: Large.
  - **C.** Serve a matching viewer for old publications until they retire. Old links keep working, and the cloud serves two viewer versions. Effort: Large.
  - **D.** Reset each stable environment, as the 0.18 cutover did. Then republish the dogfood catalogue, recreate the labelled previews, and run the preview and publish proofs. The reset deletes every account, workspace, project, token and publication. Stripe keeps its live subscriptions. Effort: Small.
  - **E.** Make the format part of the winner rule. A ready winner of an older format then loses to an upload of the same commit in the current format. It needs a migration, and it changes two cloud pages. Effort: Large.
  - **F.** A, and the version error of an older catalogue links the newest catalogue of its branch. It needs a mockup and product copy. Effort: Large.
  - **G.** A one-time job converts each stored publication to the new formats. It reverses the decision that the cloud converts no stored publication, and each later format change needs its own converter. Effort: Large.
- **Left out:** Republish an unchanged commit. It returns the same old publication.
- **Wider fix:** C. A matching viewer for each stored publication protects old links across later cutovers.
- **Previous examples:** The 0.18 cutover reset each stable environment, under `docs/ops/mokly-release-cutover.md`.
- **Related:** Item 8: the cutover happens under each of its options. Item 6.
- **Recommendation:** D. It applies the reset that the decision in force and the 0.18 precedent give, and it leaves no catalogue that the cloud cannot read. C protects existing links best.
- **Action:** ask the user, because D deletes every account of each stable environment, and each other option changes a requirement in force.

### 8. A format change breaks the cloud until a release

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `crates/mkc-mokly-contract/src/index.rs:30-37`, `crates/mkc-build-sandbox/src/versions.rs:6` and `docs/ops/mokly-release-cutover.md`.
- **Background:** Each push to `main` deploys the cloud with the workspace packages. The receiver accepts one index number, and the app's viewer reads one detail number. Customers and the cloud build runner publish with released CLIs. The runner uses the CLI that each repository installs, or the newest release. The rule in `docs/protocol/cloud/mokly-artifact-compatibility.md`, Mokly Changes, says that a protocol addition that the cloud requires must already exist in a published release. Compact JSON and the quota changes need no new format number.
- **Problem:** From the merge of index version 10, the receiver refuses each released CLI that writes index version 9 with HTTP 426. Each project fails until it upgrades its own CLI to a release that writes index version 10. Options A to D break the release rule above for that window.
- **Impact if no action:** Every cloud publication fails in that window, and each separate format release adds another window and another cutover.
- **Root question:** How do the format changes reach the cloud and each project with a released CLI, so that publications fail for the shortest time? The options check of 2026-11-27 replaced the first question, because the refusal lasts until each project upgrades, not only until the release.
- **Options:**
  - **A.** One branch and one pull request for every milestone, then a release. Compact JSON and the quotas wait for the format work. Effort: Small.
  - **B.** Two pull requests. The first carries the documentation, compact JSON and the quotas. The second carries every format change, and a release follows it. Effort: Small.
  - **C.** One pull request for each milestone, and no release until the last format change merges. The cloud refuses released CLIs from the first format merge to that release. Effort: Medium.
  - **D.** One pull request and one release for each format change. Each takes its own index number and its own cutover. Effort: Large.
  - **E.** Stage the format change across a release. The receiver and the app viewer read both format families until the first release that writes the new one. A later pull request then removes the old family. Released CLIs keep publishing, and the release rule holds. It reverses the decision against two format families, and it adds a third pull request. The plan review of 2026-11-28 added it. Effort: Large.
- **Left out:** A prerelease that a project pins before the merge. The release docs name only the `latest` dist-tag, and conductive cannot publish before the format change in any case.
- **Wider fix:** None. The grouping is a process choice.
- **Previous examples:** Release 0.18.0 shipped index version 9 and entry detail version 4 together, from PR #224.
- **Related:** Items 4 and 5 hold the format changes. Item 6: E removes its problem. Item 7 holds the cutover.
- **Recommendation:** B. Compact JSON and the quotas help every catalogue at once, and the format changes need one cutover. The first pull request alone does not let conductive publish, because its compact index is still 20.8 MB with 2,162,642 nodes. E keeps the release rule, at the cost of code that reads two format families for one release.
- **Action:** ask the user, because no option is clearly best: they trade early savings, review size and refusal time. A to D also break a rule in force.

### 9. No build time target

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
- 2026-11-27: A view whose usage record equals an earlier view of the same detail names that view instead of a copy. The reference exists only in the detail's own view type. The viewer resolves it before it gives a usage record to a frame or to inspection. Reason: 781 of 1,721 entries have four equal views, and the change saves 178.6 MB.
- 2026-11-27: The detail omits the instance `source`. Reason: no reader of a detail uses it, and the core only validates it in `crates/mokly-model/src/usage_context.rs:76-81`. It saves 12.9 MB after view sharing.
- 2026-11-27: A detail format change ships in the same release window as the index change. Reason: the receiver gates only the index number. Without an index change, a detail from an older CLI reaches the app's viewer, which reads only the new number. When the answers change the detail without the index, the receiver also gates the detail number.
- 2026-11-27: The format milestones start after the bounded-memory pull request merges into `main`. Reason: both change `CatalogueAssembler`, the detail spool and `Inventory`. Compact JSON can merge before or after that pull request, because it changes only the encoder and the fixtures.
- 2026-11-28: The cloud build runner's floor, `MIN_MOKLY_VERSION`, rises only after the first release that writes index version 10, together with its recovery texts. Reason: the toolchain gate requires the workspace version to meet the floor, and versions advance only through the release pull request.
- 2026-11-28: Preview capture, the image smoke and the cloud script tests read one generated record of the versions that the cloud receiver accepts. Reason: each copies the index version by hand today, so capture would refuse the format pull request's own preview.
- 2026-11-27: The Mokly-owned HTML bytes stay out of this plan under the recommended answers. These are the marker `path` and `props` attributes, 34.2 MB, the frame probe templates, 32.6 MB, and the copies of collected style blocks, 43.2 MB. Reason: option C of item 3 gives the target its room without them. Under option A of item 1 they become a milestone. Inline SVG stays the consumer's markup.
- 2026-11-27: Verification uses the workspace CLI against a local receiver before the merge, and the hosted cloud after the release. Reason: a released CLI does not exist until after the merge. On 2026-11-28 a one-time Plan-time proof at the target joined it.

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
  - The viewer's `control_values.ts`, `component_controls.tsx`, `component_controls_panel.tsx`, `component_control_fields.tsx`, `component_controls_state.ts`, `workspace_props.tsx` and `public_compared.ts`.
  - The reader fixtures under `docs/protocol/fixtures/`, and the generated types.
- Index version literals in the capture and smoke tools → one generated record of the receiver's versions. Moved and deleted in Milestone 5. Consumers:
  - `infra/scripts/catalogue_capture_plan.py:146-147` and `infra/scripts/smoke-images.py:43`.
  - `scripts/cloud/_tests_/build_upload_fixture_tests.py:38` and `scripts/cloud/_tests_/publication_smoke_fixture_tests.py:37`.
- One usage record for each view → a view can name an earlier view's record, in the detail's own view type. Moved and deleted in Milestone 6. Consumers:
  - The build's `crates/mokly-static/src/assembly.rs:121`, and Serve's `crates/mokly-server/src/evidence.rs` and `replacement.rs`.
  - `crates/mokly-model/src/usage_context.rs` and `detail_validation.rs`.
  - Each viewer reader of `view.usage` in a detail.
- One `usedBy` or `affected` link for each instance and view → the shape of item 10. Moved and deleted in Milestone 6. Consumers:
  - `crates/mokly-model/src/projection_usage.rs` and Serve's `crates/mokly-server/src/changes_detail.rs`.
  - `crates/mokly-compare/src/projection_workspace.rs`, `projection_removed.rs` and `detail_validation.rs`.
  - The viewer's `workspace_usage.tsx`, `workspace_panel.tsx`, `public_workspace.ts` and `workspace_data.ts`, and `packages/viewer/tests/usage_rows.test.ts`.
- After snapshots of `mokly publish` → current documents for the after pane. Moved and deleted in Milestone 7. Consumers:
  - `crates/mokly-static/src/comparison_files.rs` and `comparison_output.rs`.
  - The viewer's pane loader, the browser specs of comparisons, and the cloud smoke `scripts/cloud/viewer_index_smoke.py:45-47`.
- Snapshots and resources of every view → those of the read views only. Moved and deleted in Milestone 7. Consumers: the same files.

## Implementation Order

Under the recommended answers, the work reaches `main` in two pull requests, as item 8 proposes.

- The first pull request is the one of this plan. It carries Milestones 1 to 4. Milestones 2 and 3 can run in parallel workspaces after Milestone 1, because they change different crates. If Milestone 3 changes a contract fixture, it merges after Milestone 2.
- The second pull request starts from `main` after the first one merges, and after the bounded-memory pull request merges. Milestones 5, 6 and 7 run one after the other, because each changes the detail type and the fixtures. Milestones 8 and 9 close it.

A rule for each milestone that changes a Rust-owned shape or the producer output:

- Read the `shared-types` skill.
- Run `cargo xtask generate-types` after the shape change and before its TypeScript readers change. Delete each generated module that a rename leaves behind.
- Run `cargo xtask mokly-fixtures` after the producer change, and commit both outputs.
- End with `cargo xtask check-generated-types`, `cargo xtask mokly-fixtures --check` and the targeted tests.

After the user answers, and before Milestone 1 starts:

- The working agent rewrites the milestones for the chosen combination of answers. It keeps each TODO that an answer needs. It moves each shared TODO to a milestone that the answers keep. Such TODOs are the number raise, the generated types, the fixtures, the upgrade guide and the cutover. It rewrites each `Depends on:` line.
- When an answer adds a screen state or product copy, the plan gets a first mockup milestone and a tagged UI milestone. Option F of item 5, option E of item 3, option F of item 7 and options B and E of item 10 do so.
- The working agent sets the pass conditions of Milestone 8 for the chosen target.
- A fresh plan review with the `implementation-review` skill checks the rewritten plan.

## Milestone 1: Documentation and protocol

Depends on: none

Write the chosen requirements before any code changes. Each page whose behaviour waits gets a status line that links the milestone heading that builds it.

- [ ] Read the `documentation` skill.
- [ ] State the compact canonical form and the answer to item 11 in `docs/protocol/mokly-catalogue-serialization.md` and `docs/protocol/mokly-export-delivery.md`.
- [ ] State the counting rule and the ceilings of item 3 in `docs/protocol/cloud/publication-upload-validation.md`, `docs/protocol/mokly-upload-validation.md` and `docs/protocol/mokly-export-ownership.md:118`. State the lower limits of preview capture in `docs/protocol/cloud/preview-capture.md`. Update the memory budget of `docs/ops/environment.md`.
- [ ] Add the HTTP 426 row for an unsupported index version to `docs/protocol/mokly-upload-validation.md`, as option D of `plans/follow-ups/upload-plan-index-version-status.md` says. Delete that item.
- [ ] State index version 10 and entry detail version 5 in `docs/protocol/mokly-format-versions.md` and `docs/protocol/cloud/mokly-artifact-compatibility.md`. State the answer to item 8 beside the release rule of that page.
- [ ] Replace the decision in force of `docs/protocol/mokly-shell-delivery.md:42-44`, which chose compression over a smaller index format. Give the answer to item 4 and its reason.
- [ ] State the index records and the detail fields of item 4 in `docs/protocol/mokly-catalogue.md` and `docs/protocol/mokly-shell-delivery.md`.
- [ ] State the shared view records, the omitted `source` and the answer to item 10 in `docs/protocol/mokly-component-usage-records.md`, `docs/protocol/mokly-shell-delivery.md` and `docs/protocol/mokly-live-evidence.md`.
- [ ] State the snapshot rules of item 5 in `docs/protocol/mokly-changes-serving.md`, `mokly-export-delivery.md`, `mokly-comparison-panes.md`, `mokly-artifact-paths.md`, `mokly-comparison-serving.md`, `mokly-selected-comparisons.md` and `docs/protocol/cloud/catalogue-hosting.md`. Under option C, state the receiver rule of an immutable origin in `docs/protocol/mokly-upload-exchange.md`.
- [ ] State in `docs/protocol/cloud/cloud-build-runner.md` that the floor keeps its value until the first index 10 release ships.
- [ ] State the answer to item 6 in `docs/protocol/cloud/mokly-fixture-regeneration.md` and `docs/ops/publish-smoke.md`.
- [ ] Add the cutover of item 7 to `docs/ops/mokly-release-cutover.md`. Its publish proof needs the first release that writes index version 10.
- [ ] Update every other protocol page that names index version 9 or entry detail version 4, each with a status line. A search on 2026-11-27 found 30 pages and READMEs that name them. The READMEs and the user guides change with the code in Milestones 5 to 7.
- [ ] Update each follow-up item that names a decision or a section that this milestone changes, as the `plans` skill says. Start with `compact-json-output.md`, `variant-prop-schema-copies.md`, `unread-comparison-snapshots.md`, `snapshot-resource-copies.md`, `skip-equal-before-snapshots.md`, `embedded-document-closures.md` and `upload-quotas-not-revisited.md`.
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
- [ ] Set the ceilings of item 3 in `limits.rs` and the JSON node budgets in `json_guard.rs`. Derive the prefix quota and the marker byte quota from the file ceiling.
- [ ] Give the plan-archive scan of `crates/mkc-mokly-contract/src/tar_scan.rs:173` its own member count, apart from the file ceiling.
- [ ] Set the file ceiling in `crates/mokly-model/src/output/validation.rs`, and check that `mokly publish` applies it.
- [ ] Update the test receiver under `tests/helpers/receiver/`, the case at `scripts/cloud/publication_smoke_uploads.py:79-82`, and the allocation limit at `crates/mkc-mokly-contract/tests/memory.rs:56`.
- [ ] Keep the lower limits of preview capture at `infra/scripts/catalogue_capture_plan.py:17-18`.
- [ ] Add a regression test for each new bound, and one that a repeated file counts once.
- [ ] Measure the API with a synthetic upload at the new bounds, with conductive's nested path layout. It passes when the API stays within its 1 GiB limit and the upload ends within 60 minutes.
- [ ] Run the one-time Plan-time proof on the marker limits. Scale today's conductive marker, without its after-side entries, to the target with 25% room, beside a small stand-in index. Each copied file gets its own digest. The receiver must accept the Plan with every file listed as missing. Record the first larger copy that it refuses.
- [ ] Record the results under `.context/large-catalogue-publication/`.
- [ ] Delete `plans/follow-ups/upload-quotas-not-revisited.md`.

## Milestone 4: First pull request

Depends on: 1, 2 and 3

- [ ] Run the targeted tests and the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Keep this plan, because the work spans two pull requests.
- [ ] Record a follow-up item for each problem outside the scope that the reviews of 2026-11-27 and 2026-11-28 found. The CLI reads no rejection body, and the API gives every `TooLarge` refusal one reason, so an HTTP 413 answer names no limit.
- [ ] Update the description of this pull request with the decisions, the design calls and their dates.

## Milestone 5: Entry fields leave the index

Depends on: 4, and the bounded-memory pull request merged into `main`

Index version 10 and entry detail version 5 start here. Each detail of a screen or a component carries its prop schema, its saved props and its controls. Expected result for conductive: the index falls from 20.8 MB and 2,162,642 nodes to 2.85 MB and 150,688 nodes. The details grow by about 18 MB, so the total stays about the same.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Raise the numbers in `crates/mokly-model/src/versions.rs`, the `ts` attributes at `crates/mokly-model/src/public_index.rs:125` and `public_detail.rs:142`, and the viewer gates at `packages/viewer/src/catalogue/index_reader.ts:11` and `detail_reader.ts:11`.
- [ ] Move the fields from `crates/mokly-model/src/projection_records.rs` into the detail projection.
- [ ] Read the component schemas from the component details in `usage_schemas.rs` and `detail_context.rs`. Update the strict and the lenient readers.
- [ ] Update the base projections of `mokly-compare` and each Serve route that reads the fields.
- [ ] Run `cargo xtask generate-types`. Then read the control target from the detail in the viewer, and move each viewer consumer of the old fields.
- [ ] Accept only index version 10 in `crates/mkc-mokly-contract/src/index.rs`, and update its tests and its corpus.
- [ ] Give preview capture, the image smoke and the cloud script tests one generated record of the versions that the cloud receiver accepts. Write it from the contract crate, and move the version checks of the Replaced Ways list to it.
- [ ] Apply the answer to item 6 to the published-package smoke at `scripts/cloud/publication_smoke_cli.py:74-79`.
- [ ] Rename the fixture names in `xtask/scripts/mokly-fixtures.mjs:105` and `xtask/scripts/mokly-fixture-artifacts.mjs:197`. Rename and rewrite the reader fixtures under `docs/protocol/fixtures/`. Run `cargo xtask mokly-fixtures`.
- [ ] Search for every other consumer of the old fields and the old numbers, and move it.
- [ ] Update each README that names index version 9 or entry detail version 4.
- [ ] Measure the index of conductive: its bytes and its nodes.
- [ ] Delete `plans/follow-ups/variant-prop-schema-copies.md`.
- [ ] End with the checks of the rule in Implementation Order.

## Milestone 6: Usage records written once

Depends on: 5

Expected saving for conductive under option D of item 10: about 264 MB. The details fall from about 432.2 to about 168.2 MB. Under option F they fall to about 220.2 MB.

- [ ] Read the `rust`, `shared-types`, `typescript` and `testing` skills.
- [ ] Write the shared view records and the omitted `source` in the detail projection. Keep instance props inline. Keep the view reference in the detail's own view type, so that `CatalogueUsage` keeps its shape.
- [ ] Write the usage lists that item 10 chooses, in `projection_usage.rs` and Serve's `changes_detail.rs`. Write the same shape for `affected` and for removed entries in `crates/mokly-compare/src/projection_workspace.rs` and `projection_removed.rs`.
- [ ] Check the new shapes in `usage_context.rs`, `detail_validation.rs` and the lenient readers.
- [ ] Run `cargo xtask generate-types`. Then give the viewer one reader that resolves a view's usage record from its detail. The render answer, the frame adapters and inspection keep reading `CatalogueUsage`.
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
- [ ] Run each changed browser spec of comparisons 10 times, and record the pass count.
- [ ] Run `cargo xtask generate-types` and `cargo xtask mokly-fixtures`.
- [ ] Delete `plans/follow-ups/unread-comparison-snapshots.md` and `snapshot-resource-copies.md`. Narrow `skip-equal-before-snapshots.md` to the equal before documents of comparable entries. Update `embedded-document-closures.md`, whose lines 42-44 describe static comparisons.
- [ ] Add the upgrade section for index version 10 and entry detail version 5 to `docs/guides/start/upgrade.md`, with the `external docs implementor` action. It covers Milestones 5 to 7.
- [ ] End with the checks of the rule in Implementation Order.

## Milestone 8: Conductive verification

Depends on: 7

- [ ] Build conductive at `3371d05f` with the workspace CLI, current-only, and record the output.
- [ ] Add one local commit that changes `components/common/icon-button` and the wrapper of conductive's renderer, `docs/mockups/src/render.tsx`, so that every view gets a before pane. Build it with Changes against its parent.
- [ ] Publish each case cold to an empty project of a local receiver, as the interactive local procedure of `docs/ops/publish-smoke.md` says. `mokly publish` builds its own output, so the measurements come from the builds above.
- [ ] Require a before pane for every view of the published index. Require a marker entry for each pane document, and a successful load of each pane file.
- [ ] Run the one-time Plan-time proof on the whole new output. Scale its marker and its index to the target of item 2 with 25% room. The receiver must accept the Plan with every file listed as missing. Record the first larger copy that it refuses.
- [ ] Record the declared and the distinct bytes, the files, the prefixes, the index bytes and nodes, the build time and the peak RSS. Compare them with the target of item 2.
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
- [ ] Raise `MIN_MOKLY_VERSION` in `crates/mkc-build-sandbox/src/versions.rs` to that release. Update its recovery texts with it, and their tests:
  - `packages/app/src/viewer/build-copy.ts:31` and `docs/mockups/src/fixtures/build-copy.ts:15`.
  - `crates/mkc-publications/src/build_check_summary.rs:170` and `crates/mkc-api/src/upload_error.rs:23`.
  - `docs/protocol/cloud/viewer-builds.md:60`, `changes-check-builds.md:45` and `rest-api-surface.md:147`.
- [ ] Run the cutover of item 7 in each stable environment.
- [ ] Record the capture again with `infra/scripts/record-catalogue-capture.py`, against the first release that writes index version 10.
- [ ] Upgrade `@mokly/mokly` in conductive, in its own repository.
- [ ] Publish a push and a pull request of conductive through the cloud build on the bigger template, and record the result.
