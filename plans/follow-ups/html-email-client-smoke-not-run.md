# HTML email client smoke has no recorded result

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first unchecked post-merge task of the deleted `plans/html-emails.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/ops/`, which has no email smoke section yet.
- **Reason:** The smoke needs real delivered mail from the deployed `main-preview` mailer, so it waits until after the merge of PR #47 on 2026-10-19.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the smoke. The repository tests only the generated templates, and no result from a real mail client is recorded.

- **Terms:**
  - **Postmark:** The mail provider that sends the sign-in and invitation emails from hosted templates.
- **Background:** PR #47 made the sign-in and invitation emails HTML, generated from the mockup catalogue. `docs/protocol/cloud/email.md` defines the messages and their dark mode behaviour. Gmail web, Apple Mail, iOS Mail and Outlook render HTML mail in different ways. The repository tests check the generated templates, not a real inbox. The absence of a recorded result does not prove that nobody ran the smoke.
- **Task:** After a `main-preview` rollout that carries the HTML templates, run the smoke below.
  - Request a sign-in link and send an invitation to inboxes that an operator controls.
  - Inspect both messages in Gmail web, in light mode and in Gmail's own inversion.
  - Inspect both messages in iOS Mail in dark mode and in Outlook desktop.
  - Record the captures and findings in a new email smoke section under `docs/ops`.
  - Open one follow-up item for each client-specific fix.
- **Impact if no action:** A client that renders the templates badly stays unnoticed until a user reports it. A broken sign-in email blocks sign-in.
- **Needs:** A `main-preview` rollout with the HTML templates, operator-controlled inboxes, and the three mail clients of the task: Gmail web, iOS Mail and Outlook desktop. Keep sign-in tokens out of the published captures.
- **Done when:** The email smoke section in `docs/ops` records both messages in each client, and each problem has a follow-up item.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/html-emails.md?plain=1#L523-L535) of the deleted plan.
