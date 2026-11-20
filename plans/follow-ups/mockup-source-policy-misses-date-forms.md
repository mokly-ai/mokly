# Source policy misses some machine-dependent date forms

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch `conductor/mokly-rust-core-upgrade-m2-b-mockups`. That branch applied the decided source policy of the deleted item `mockup-drawings-read-clock-and-locale.md` and moved that item's options C and E here.
- **Location:** `docs/mockups/src/_tests_/deterministic-date-values.ts:91-95`, `docs/mockups/src/_tests_/deterministic-locale-policy.ts:29-60`, `docs/mockups/src/_tests_/deterministic-source-policy.ts:16-33` and `docs/protocol/cloud/mockup-source-policy.md:29-43`.
- **Reason:** Each option adds a rejection to the source policy, and the user decides each new rejection.

- **Terms:**
  - **Drawing:** An authored mockup source under `docs/mockups/src`, outside `_tests_`, that Mokly renders into catalogue pages.
  - **Source policy:** The test in `docs/mockups/src/_tests_/deterministic-source-policy.test.ts`, with its rules in the other `deterministic-*.ts` modules, which scans every drawing for inputs from the build machine.
- **Background:** The list below gives the facts.
  - A drawing that reads the local time zone or the host locale renders different bytes on different machines.
  - On 2026-10-12 the user decided on a source policy that requires an explicit time and locale for dates. `docs/protocol/cloud/mockup-source-policy.md` states its rules.
  - A date string must be a compile-time constant, and a string with a time must end with `Z` or an explicit offset.
  - Local-time `Date` members and the default `Date` string conversion fail. Each locale-sensitive call names a string-literal locale, and date formatting also names a `timeZone`.
  - No current drawing uses `Date`, `Intl`, a locale method or `navigator`. Checked on 2026-11-01, at commit `abf42851`.
- **Problem:** The policy passes the forms below, which depend on the build machine. On 2026-11-01 a run of the policy on one-line fixtures found no violation in any of them.
  - `new Date("October 12, 2026")`, `new Date("2026/10/12")` and `Date.parse("Oct 12 2026")`. They have no time, so the offset rule does not apply, and they parse as local midnight.
  - `new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).format()` and `formatToParts()`, with no date. They format the current date.
  - `dates.join(", ")` and `` `${dates}` `` for a `Date[]`, and `<div data-when={d} />` for a `Date`. Each uses the default local string conversion.
  - `navigator.language`. The policy's list of ambient inputs omits `navigator`.
  - A fallback locale, such as `"xx-XX"`. A literal locale that the runtime lacks uses the host locale.
- **Impact if no action:** A drawing that uses one of these forms renders bytes that depend on the machine, and no check fails. Mokly's comparisons and published catalogues can then differ by the machine that built them.
- **Root question:** How does the source policy keep the dates and locales of every drawing independent of the build machine?
- **Options:**
  - **A.** Add the listed forms to the policy, with a fixture for each form and the doc text. It closes only the listed forms, and the fallback locale stays open. Effort: Small.
    - Accept only ISO 8601 date strings.
    - Require a date argument for `format` and `formatToParts`.
    - Treat `Date` arrays and `Date` attribute values as string conversion.
    - Reject `navigator`.
  - **B.** Format every date and number through one fixture helper. The helper takes an ISO UTC string or a number, and returns text in one fixed locale with `timeZone: "UTC"`. The policy then rejects `Date` and `Intl` outside the helper, and the doc's date and locale rules become one rule. It changes an authoring rule. Effort: Medium.
- **Left out:** The list below gives the approaches that the options leave out.
  - Change nothing. The forms above stay open, so it fails the goal of the 2026-10-12 decision.
  - Run the second determinism build under another time zone and locale. `plans/follow-ups/mockup-determinism-builds-share-time-zone.md` holds that choice, because it covers installed packages too.
  - Pin the time zone and the locale for every build. The drawings still depend on these settings, so a build without the pin renders other bytes.
- **Wider fix:** B. No drawing can then construct a local-time date or use a host locale. A detects only the forms that it lists.
- **Previous examples:** The list below gives them.
  - A review of the closed PR #39 on 2026-10-12 found that its date rules missed local construction, locale defaults and string conversion.
  - A later review of the same work found global-object aliases, wrapped ambient access, Node built-in imports and local-time setters.
  - The review of the closed PR #70 found the forms above.
- **Related:** `plans/follow-ups/mockup-determinism-builds-share-time-zone.md` gives a detection approach to the same goal. It also catches some of these forms in installed packages. The two answers do not conflict.
- **Recommendation:** B. It removes the class, while each earlier review found forms that the rules of that time missed. A is the smallest change.
- **Action:** ask the user, because both options add a rejection to the source policy, and the user decides each new rejection.

Evidence. Node 24.21.0 printed these values on 2026-11-01. They show that each form depends on the build machine.

- `new Date("October 12, 2026")`, formatted by `en-GB` with `timeZone: "UTC"`: "12 Oct 2026" under `TZ=UTC`, and "11 Oct 2026" under `TZ=Europe/Berlin` and under `TZ=Pacific/Kiritimati`.
- `[new Date("2026-10-12T00:00:00Z")].join(", ")`: "Mon Oct 12 2026 00:00:00 GMT+0000 (Coordinated Universal Time)" under `TZ=UTC`. Under `TZ=Europe/Berlin` with `LC_ALL=de_DE.UTF-8` it printed "Mon Oct 12 2026 02:00:00 GMT+0200 (Mitteleuropäische Sommerzeit)".
- `navigator.language`: "en-US", "de-DE" and "tr-TR" under `LC_ALL` set to `C.UTF-8`, `de_DE.UTF-8` and `tr_TR.UTF-8`.
- `new Intl.NumberFormat("xx-XX").format(1234.5)`: "1,234.5" under `LC_ALL=C.UTF-8`, and "1.234,5" under `LC_ALL=de_DE.UTF-8`.
