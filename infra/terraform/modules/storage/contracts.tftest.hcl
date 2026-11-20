mock_provider "google" {}

variables {
  project         = "mokly-508518"
  region          = "us-central1"
  environment     = "main-preview"
  workload_emails = { "api" : "mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com", "catalogue" : "mkc-main-preview-cat@mokly-508518.iam.gserviceaccount.com" }
}

run "contracts" {
  command = plan
  assert {
    condition     = google_storage_bucket.blobs.name == "mokly-508518-main-preview-blobs"
    error_message = "Foundation must provision the bucket advertised by environment."
  }
  assert {
    condition     = google_storage_bucket.blobs.uniform_bucket_level_access && google_storage_bucket.blobs.public_access_prevention == "enforced"
    error_message = "private_bucket contract changed."
  }
  assert {
    condition     = alltrue([for rule in google_storage_bucket.blobs.lifecycle_rule : one(rule.action).type != "Delete" || one(rule.condition).with_state == "ARCHIVED"])
    error_message = "live_data_preserved contract changed."
  }
  assert {
    condition     = google_storage_bucket_iam_member.objects["catalogue"].role == "roles/storage.objectViewer"
    error_message = "read_only_catalogue contract changed."
  }
  assert {
    condition     = !google_storage_bucket.blobs.force_destroy
    error_message = "stable_protection contract changed."
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
