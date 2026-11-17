# Both determinism builds share the time zone

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch `conductor/mokly-rust-core-upgrade-m2-b-mockups`. That branch applied the decided source policy of the deleted item `mockup-drawings-read-clock-and-locale.md` and moved that item's options B and D here.
- **Location:** `ts/mockups/scripts/check-determinism.mjs:11-24` at commit `abf42851`, and the section "Build Determinism" of `docs/protocol/mockup-verification.md`.
- **Reason:** Each option makes the determinism check reject more output, and the user decides each new rejection.

- **Terms:**
  - **Determinism check:** `test:determinism`, the first step of `npm run mockups:test`. It builds the mockup catalogue a second time and compares both builds byte for byte.
  - **Source policy:** The test in `docs/mockups/src/_tests_/deterministic-source-policy.test.ts`, which scans every authored mockup source for inputs from the build machine. `docs/protocol/mockup-source-policy.md` states its rules.
- **Background:** The list below gives the facts.
  - At commit `abf42851`, the determinism check runs the second build with the caller's environment. So both builds read the same time zone and the same locale.
  - Output that depends on the time zone or the locale is therefore the same in both builds, and the check passes.
  - On 2026-10-12 the user decided on the source policy. It rejects the known machine inputs in the authored sources. It does not read the code of installed packages.
  - `plans/follow-ups/mockup-determinism-rebuilds-in-same-checkout.md` changes where and how the second build runs. Its fix decides the environment that option A changes.
- **Problem:** No check varies the time zone or the locale between the two builds. A dependence in an installed package, or a date form that the source policy misses, renders other bytes on another machine, and no check fails.
- **Impact if no action:** Mokly's comparisons and published catalogues can differ by the machine that built them, through a package or through a form that the source policy misses.
- **Root question:** How does the determinism check find output that depends on the time zone or the locale of the build machine?
- **Options:**
  - **A.** Keep the source policy, and run the second build under another time zone and locale, such as `TZ=Pacific/Kiritimati` and `LC_ALL=tr_TR.UTF-8`. Update the section "Build Determinism" of `docs/protocol/mockup-verification.md` and the introduction of `docs/protocol/mockup-source-policy.md`. It also catches a dependence in a package, when the two builds print different text. It can expose an existing dependence in a package. Effort: Medium.
  - **B.** Do A, and drop the source policy. It changes the user's decision of 2026-10-12. It misses a clock read that prints the same text in both builds. Effort: Medium.
- **Left out:** The list below gives the approaches that the options leave out.
  - Change nothing. A dependence in an installed package then stays unchecked, so it fails the goal.
  - Pin the time zone and the locale for every build. The output still depends on these settings, so a build without the pin renders other bytes. On Node 24, a `process.env` change inside the build sets the time zone but not the default locale.
- **Wider fix:** None. Both options are detection fixes. For the authored sources, option B of `plans/follow-ups/mockup-source-policy-misses-date-forms.md` is the structural fix. Installed packages have no structural fix in this repository.
- **Previous examples:** The list below gives them.
  - The record `source-policy-misses-some-date-forms.md`, merged into the deleted item on 2026-10-31, recommended this check as the smallest change for the date forms.
  - `plans/mokly-review-follow-ups.md:908-909` on branch `calummoore/untitled-v2` records the date-form gap as an open Low item and recommends to vary `TZ` and `LC_ALL`.
- **Related:** The list below gives the links.
  - `plans/follow-ups/mockup-source-policy-misses-date-forms.md` closes the same gap in the authored sources. The two answers do not conflict.
  - `plans/follow-ups/mockup-determinism-rebuilds-in-same-checkout.md`, same code. Its environment for the second build decides where option A sets `TZ` and `LC_ALL`. `docs/protocol/mockup-source-policy.md` makes no claim about the environment of either build.
- **Recommendation:** A. It keeps the decided source policy and adds the one check that sees installed packages, as the merged record of 2026-10-31 recommended.
- **Action:** ask the user, because both options make the determinism check reject more output, and the user decides each new rejection.

Evidence. Another time zone does not catch every form. On 2026-11-01, Node 24.21.0 formatted `new Date("October 12, 2026")` with `en-GB` and `timeZone: "UTC"` as "11 Oct 2026" under both `TZ=Europe/Berlin` and `TZ=Pacific/Kiritimati`, and as "12 Oct 2026" under `TZ=UTC`. A second build under `Pacific/Kiritimati` therefore misses that form when the first build runs under `Europe/Berlin`. A clock read that prints the same text in both builds also passes.
