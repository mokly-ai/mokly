# Real phone slug keyboards remain unverified

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from finding 4 of the review of `calummoore/plans-skill-update` and the readable-addresses operator task of 2026-09-23.
- **Location:** `packages/app/src/screens/account/create-workspace-screen.tsx:33`, `packages/app/src/screens/account/project-address.tsx:22`, `packages/app/src/settings/panes/slug-editor.tsx:105` and `packages/app/src/_tests_/identifier-field-support.ts`.
- **Reason:** The check needs real phones and a reachable app, which the cloud workspace's browser tests do not provide.
- **Checked:** 2026-10-31, at commit `f568853e`. Not verified. The attribute tests still pass through Chromium only, and no dated device result was found. No phone keyboard defect is known.

- **Terms:**
  - **Slug:** The address segment that identifies a workspace or project in its readable URL.
- **Background:** The app configures slug fields to disable automatic capitalization, correction and spellcheck. Ordinary name fields keep normal text behavior. Automated tests inspect the rendered attributes. The mobile test project uses desktop Chromium at a phone-sized viewport and shows no phone keyboard. The earlier work left real phone keyboard behavior as an operator check. On 2026-10-31, `docs/ops` and a search of the repository's pull requests gave no dated device result. That absence does not prove that nobody ran the check.
- **Related:** `plans/follow-ups/mobile-test-comments-describe-old-behavior.md`, same helper code: its comment correction does not complete this manual check.
- **Task:** Check the current app on an iPhone with Safari and an Android phone with Chrome.
  - Open each slug field with the device's on-screen keyboard. Enter and edit a valid lowercase address with letters, digits and a hyphen.
  - Check workspace creation, project creation from a repository, project creation from the CLI form, workspace settings and project settings.
  - Confirm that the keyboard does not automatically capitalize or correct the slug and that spellcheck stays off.
  - Confirm that ordinary workspace and project name fields keep normal text behavior.
  - Record the date, devices, OS and browser versions, keyboard/input method, surfaces and results in an operations verification record.
  - Keep raw screenshots or recordings under ignored `.context/`. Create a separate follow-up for each confirmed defect.
- **Impact if no action:** The keyboard behavior stays unverified on real devices. Automatic changes could make a valid address fail lowercase validation.
- **Needs:** The two physical phones, a deployed preview or stable app, and an account that can create and edit the test workspace and project.
- **Done when:** A dated result covers all five slug surfaces on both devices and ordinary name fields. Each failure has its own follow-up item.

The implementation sets `autoCapitalize="none"`, `autoCorrect={false}` and `spellCheck={false}` for identifiers. Attribute tests and emulator runs do not complete this manual device check. No permanent keyboard test is required.

Source: [the unresolved operator check](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1202-L1209) and [the identifier behavior](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/readable-addresses.md?plain=1#L1011-L1031).
