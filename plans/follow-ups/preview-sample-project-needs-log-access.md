# Private preview sample project hides its Changes

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-19, from the branch `calummoore/combine-mokly-cloud-into-repo-704s`, review finding 201: the new option D of its check. Updated on 2026-11-25 on the branch `calummoore/preview-password-sign-in-jofl`: the preview password removed the need for log access to sign in, and its option B went.
- **Location:** `crates/mkc-api/src/preview_seed/identity_validation.rs:55`, `crates/mkc-api/src/preview_seed/identity.rs`, `crates/mkc-api/src/preview_seed/_tests_/service/fixtures.rs:57`, `crates/mkc-api/tests/preview_seed/`, `docs/protocol/cloud/preview-seed.md`, section "Seed Steps", `docs/protocol/cloud/preview-seed-local.md`, section "Local Stack", `docs/ops/preview.md`, section "Review A Labelled PR", and `docs/development/cloud.md`, section "Local Preview Stack".
- **Reason:** A public sample project changes a requirement of the preview seed contract and what each preview shows, and no user decision covers that change.

- **Terms:**
  - **Sample project:** the project `Mokly Cloud`, slug `mokly`, repository `mokly-ai/mokly`, that the preview seed creates with the pull request's mockups. It is in the workspace `Mokly` (`mokly-ai`) of the shared preview account `preview@mokly.ai`.
  - **Preview password:** one shared password that signs in the shared preview account on Sign in of every preview. Each preview holds only a scrypt verifier of it. `docs/protocol/cloud/preview-sign-in.md` defines it.
  - **Private artifact limit:** the embedded viewer fetches comparison documents without credentials, so it cannot show the Changes of a private catalogue. `docs/protocol/cloud/viewer.md`, section "Private Artifact Limit", defines it.
- **Background:**
  - On 2026-11-17 Mokly Cloud moved into this public repository, `mokly-ai/mokly`. Its previews deploy one namespace for each pull request with the `preview` label.
  - The seed requires a private sample project. Step 6 of the section "Seed Steps" of `docs/protocol/cloud/preview-seed.md` states it, and `identity_validation.rs:55` checks it. PR previews set the preview plan to `team`, and Team makes new projects private by default. No document records why the sample project must be private.
  - On 2026-11-25 Cal approved the preview password. A reviewer types it on Sign in of the preview app and signs in the shared account, with no cluster log access. Before it, a reviewer of this public repository read an emailed sign-in link from the API logs with `kubectl`, or asked an operator to read it.
  - Only the shared account can open the private sample project. Its Changes show an overlay without an action, because of the private artifact limit.
  - `docs/protocol/cloud/platform-model.md`, section "Projects And Visibility", says that public visibility grants anonymous project reads and publication reads. It never grants mutations or access to members and tokens. A change of a project to public does not need Team.
- **Problem:** A preview cannot show the Changes of its pull request, because its sample project is private. Only a reviewer with the preview password can open the sample project.
- **Impact if no action:** Reviewers cannot check the Changes of a pull request in its preview.
- **Root question:** How can a reviewer of this public repository see the Changes of a pull request in its preview?
- **Options:**
  - **A.** Keep the private sample project. Reviewers sign in with the preview password and browse the current catalogue, and Changes stay unavailable. Nothing changes. Effort: Small.
  - **C.** Make the sample project public in previews. The seed creates or changes the project to `public` and requires `public`. Anyone with the address then opens the sample project and its Changes without a sign-in. Update the seed contract, the local seed page, the runbook, the local stack guide, the seed tests, and `plans/follow-ups/seed-kept-rules-lost-tests.md`, whose option A uses a public project as its mismatch case. The sample project then no longer exercises a private catalogue in previews. Effort: Medium.
- **Left out:** Option B, an operator command that printed the shared sign-in link from the namespace Secret `preview-sign-in`, left on 2026-11-25, because the preview password replaced that random link value, and the Secret now holds only a verifier that opens nothing. A credential in the PR comment breaks the rule that the comment carries no credential. GitHub sign-in in previews breaks the rule that PR previews disable the GitHub App. Real email in previews needs a Postmark secret in each preview namespace, which previews do not have. A private repository reverses the move of the cloud into this public repository.
- **Wider fix:** None. This is one product choice for previews.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/seed-kept-rules-lost-tests.md`, same code: its project mismatch test uses a public project, so option C changes that test case.
- **Recommendation:** C. It shows the Changes, and the mockups of this public repository are public already.
- **Action:** ask the user, because the recommended option changes a requirement of the preview seed contract and what each preview shows, and no user decision covers that change.
