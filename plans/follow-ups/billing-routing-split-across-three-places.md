# Billing routing is split across three places

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch `calummoore/preview-password-sign-in-jofl`, round 1 review, finding 8, "Billing still has parallel routing paths". Its check moved it outside the scope, because the split is unchanged from `origin/main`.
- **Location:** `crates/mkc-api/src/router.rs:36`, `:56` and `:104-112` (the `billing_configured` flag and the header check that it guards), `crates/mkc-api/src/application_server.rs:48`, `crates/mkc-api/src/configuration.rs:43-61` (`dispatch_target`), `crates/mkc-api/src/dispatch.rs` (`ApiDispatcher::dispatch`), `crates/mkc-api/src/endpoints.rs:54-56`, and `crates/mkc-api/src/platform/_tests_/dispatch_tests.rs:56`.
- **Reason:** The router flag, the `Endpoint::Billing` marker and its test arm are unchanged from `origin/main`, so the fix belongs to a separate branch.
- **Category:** Code structure.

- **Terms:**
  - **Operation gate:** `ApiDispatcher::dispatch_target` in `crates/mkc-api/src/configuration.rs`. It selects the configured service of an optional operation, or it answers 503 `operation-unavailable`.
  - **Billing webhook:** an incoming Stripe notification, operation `ReceiveBillingWebhook`. The API validates it with its `stripe-signature` header.
  - **Configuration answer:** the public `GET /v1/configuration`, which reports each optional configuration that the gate accepts. Its `billing` field reads the same gate.
- **Background:**
  - The branch `calummoore/preview-password-sign-in-jofl` moved billing into the operation gate, and the configuration answer reads the gate. On `origin/main`, `ApiDispatcher::dispatch` sent billing operations to `dispatch_billing`, which checked `self.billing` itself. So the branch narrowed the split from four places to three.
  - The router still needs to check that a billing webhook carries exactly one `stripe-signature` header, before it reads the body. It makes that check only when billing is configured, so that an unconfigured API answers `operation-unavailable` first.
  - For that check the router reads its own `billing_configured` flag, in `router.rs:104-112`. `application_server.rs:48` sets the flag from `self.settings.billing.is_some()`, not from the gate.
  - `endpoints::action` still returns an `Endpoint::Billing` marker for a billing operation, in `endpoints.rs:54-56`. `ApiDispatcher::dispatch` calls `endpoints::action` only when the gate selects the standard target, so the product never builds that marker.
  - The inventory test builds the marker and checks the same predicate that selected it: `Endpoint::Billing => assert!(operation.billing())`, in `dispatch_tests.rs:56`.
- **Problem:** Billing routing reads three sources: the router's settings flag, the standard parser's marker and the gate. The marker assertion does not exercise the route that serves billing.
- **Impact if no action:** A change to billing routing must keep three places in step. The marker test passes even when the real billing route breaks.
- **Root question:** How can billing use one service selection for public discovery, request validation, and dispatch?
- **Options:**
  - **A.** Read the operation gate for the webhook's early header check. Remove the extra flag, and replace the marker assertion with a test of the actual billing dispatch. Effort: Medium.
  - **B.** Let the gate produce the route selection that header validation, dispatch, and public discovery share. Remove the old billing flag and the marker. Keep the order of the request checks. Effort: Medium.
- **Left out:** Move the header check after the body read. It can change the existing order of errors. Fewer than three approaches are real. Both options keep the check early and share one selection. They differ only in how much of the route the gate selects.
- **Wider fix:** B. One selection carries the configured service through the whole request.
- **Previous examples:** The GitHub path has the same split. The standard parser keeps an `Endpoint::GitHub` marker, in `endpoints.rs:51-53`, after the gate selected the GitHub path. Both markers came into this repository with commit `5cba4dc4b`.
- **Recommendation:** B. It removes the parallel routing paths and keeps the existing checks.
- **Action:** fix after merge, apply B, because both sources agree today and the change reaches the general router and its tests.
