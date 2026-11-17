mock_provider "google" {}

variables {
  project     = "mokly-508518"
  environment = "main-preview"
}

run "contracts" {
  command = plan
  assert {
    condition     = google_service_account.workload["api"].account_id == "mkc-main-preview-api" && google_service_account.workload["catalogue"].account_id == "mkc-main-preview-cat" && google_service_account.workload["reset"].account_id == "mkc-main-preview-reset"
    error_message = "Foundation must provision the shared naming module's workload IDs."
  }
  assert {
    condition     = length(google_service_account.workload) == 3 && length(toset([for account in google_service_account.workload : account.account_id])) == 3
    error_message = "separate_roles contract changed."
  }
  assert {
    condition     = google_service_account_iam_member.workload["api"].member == "serviceAccount:mokly-508518.svc.id.goog[mkc-main-preview/api]"
    error_message = "exact_namespace contract changed."
  }
  assert {
    condition     = google_service_account_iam_member.workload["reset"].member == "serviceAccount:mokly-508518.svc.id.goog[mkc-main-preview/reset]"
    error_message = "Only the reset Kubernetes account may assume the database-reset identity."
  }
}

run "reject_pull_request_environment" {
  command = plan
  variables { environment = join("-", ["preview", "pr", "42"]) }
  expect_failures = [var.environment]
}
run "reject_other_branch_environment" {
  command = plan
  variables { environment = "release-preview" }
  expect_failures = [var.environment]
}
