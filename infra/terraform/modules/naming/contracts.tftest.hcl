variables {
  project     = "mokly-508518"
  environment = "production"
}
run "production_names" {
  command = plan
  assert {
    condition     = output.account_ids.api == "mkc-production-api" && output.account_ids.catalogue == "mkc-production-cat" && output.account_ids.reset == "mkc-production-reset" && length(output.account_ids) == 3
    error_message = "Keep distinct, stable workload and database-reset account IDs."
  }
  assert {
    condition     = output.emails.api == "mkc-production-api@mokly-508518.iam.gserviceaccount.com" && output.emails.catalogue == "mkc-production-cat@mokly-508518.iam.gserviceaccount.com" && output.emails.reset == "mkc-production-reset@mokly-508518.iam.gserviceaccount.com"
    error_message = "Environment SQL users must resolve to the foundation accounts."
  }
  assert {
    condition     = output.bucket == "mokly-508518-production-blobs" && output.namespace == "mkc-production"
    error_message = "Preserve existing production bucket and namespace names."
  }
}
run "main_preview_names" {
  command = plan
  variables { environment = "main-preview" }
  assert {
    condition     = output.account_ids.api == "mkc-main-preview-api" && output.account_ids.catalogue == "mkc-main-preview-cat" && output.account_ids.reset == "mkc-main-preview-reset" && output.bucket == "mokly-508518-main-preview-blobs" && output.namespace == "mkc-main-preview"
    error_message = "Main-preview resources must remain isolated from production."
  }
}
run "project_input" {
  command = plan
  variables {
    project     = "another-project"
    environment = "main-preview"
  }
  assert {
    condition     = alltrue([for id in values(output.account_ids) : length(id) <= 30]) && output.emails.api == "mkc-main-preview-api@another-project.iam.gserviceaccount.com" && output.bucket == "another-project-main-preview-blobs"
    error_message = "Honor the project input and the service-account ID length limit."
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
