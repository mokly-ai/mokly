mock_provider "google" {}

variables {
  project     = "mokly-508518"
  region      = "us-central1"
  environment = "main-preview"
  workload_emails = {
    api       = "mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com"
    catalogue = "mkc-main-preview-cat@mokly-508518.iam.gserviceaccount.com"
  }
}

run "contracts" {
  command = plan
  assert {
    condition = toset(keys(google_secret_manager_secret_iam_member.workload)) == toset([
      "api/catalogue-signing-key", "api/postmark-token", "api/github-app-key",
      "api/github-client-secret", "api/github-webhook-secret", "api/stripe-secret-key",
      "api/stripe-webhook-secret", "api/e2b-api-key", "catalogue/catalogue-signing-key"
    ])
    error_message = "Stable APIs read signing, mail, GitHub, Stripe and E2B secrets; catalogue reads only the signing key."
  }
  assert {
    condition = alltrue([for key, binding in google_secret_manager_secret_iam_member.workload :
      binding.member == "serviceAccount:${var.workload_emails[split("/", key)[0]]}" &&
      binding.secret_id == "mkc-main-preview-${split("/", key)[1]}" &&
      binding.role == "roles/secretmanager.secretAccessor"
    ])
    error_message = "Managed CSI must read environment secrets as the annotated Google service accounts."
  }
  assert {
    condition     = length(google_secret_manager_secret.this) == 13
    error_message = "The foundation owns stable secret IDs, never their values."
  }
  assert {
    condition = (
      google_secret_manager_secret.this["stripe-catalogue-key"].secret_id == "mkc-main-preview-stripe-catalogue-key" &&
      alltrue([for binding in google_secret_manager_secret_iam_member.workload :
        binding.secret_id != "mkc-main-preview-stripe-catalogue-key"
      ])
    )
    error_message = "The catalogue key must exist without any workload reader."
  }
  assert {
    condition     = google_secret_manager_secret.this["postmark-token"].replication[0].user_managed[0].replicas[0].location == "us-central1"
    error_message = "Secret replication must stay in the selected region."
  }
}

run "production_readers" {
  command = plan
  variables {
    environment = "production"
    workload_emails = {
      api       = "mkc-production-api@mokly-508518.iam.gserviceaccount.com"
      catalogue = "mkc-production-cat@mokly-508518.iam.gserviceaccount.com"
    }
  }
  assert {
    condition = length(google_secret_manager_secret.this) == 13 && length(google_secret_manager_secret_iam_member.workload) == 9 && alltrue([
      for key, binding in google_secret_manager_secret_iam_member.workload :
      binding.member == "serviceAccount:${var.workload_emails[split("/", key)[0]]}" &&
      binding.secret_id == "mkc-production-${split("/", key)[1]}"
    ])
    error_message = "Production must use its own Google identities and secret IDs."
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
