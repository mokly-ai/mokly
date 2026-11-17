mock_provider "google" {
  mock_resource "google_service_account" {
    defaults = {
      name  = "projects/mokly-508518/serviceAccounts/mkc-fixture@mokly-508518.iam.gserviceaccount.com"
      email = "mkc-fixture@mokly-508518.iam.gserviceaccount.com"
    }
  }
}
override_resource {
  target = google_service_account.github["foundation"]
  values = {
    name  = "projects/mokly-508518/serviceAccounts/mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
    email = "mkc-github-foundation@mokly-508518.iam.gserviceaccount.com"
  }
}

variables {
  project       = "mokly-508518"
  repository_id = "123456"
  owner_id      = "987654"
  repository    = "mokly-ai/mokly-cloud"
}

run "contracts" {
  command = plan
  assert {
    condition     = strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository_id == '123456'") && strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository_owner_id == '987654'")
    error_message = "trusted_numeric_identity contract changed."
  }
  assert {
    condition     = strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "preview.yml@refs/heads/main") && strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "'mokly-ai/mokly-cloud/.github/workflows/foundation.yml@refs/heads/main'") && keys(google_service_account_iam_member.github) == ["apply/deploy", "deploy/deploy", "deploy/preview", "foundation/foundation", "plan/ci", "plan/deploy", "plan/foundation", "postmark/deploy"] && keys(google_service_account.github) == ["apply", "deploy", "foundation", "plan", "postmark"]
    error_message = "trusted_workflow_ref contract changed."
  }
}

run "workflow_trust" {
  command = apply
  assert {
    condition = alltrue([for binding in google_service_account_iam_member.github :
      strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "'${trimprefix(binding.member, "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/")}'")
    ])
    error_message = "Every trusted workflow binding must name a workflow ref that the provider condition accepts."
  }
  assert {
    condition = (
      [for key, binding in google_service_account_iam_member.github : binding.member if binding.service_account_id == google_service_account.github["foundation"].name] ==
      ["principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/mokly-ai/mokly-cloud/.github/workflows/foundation.yml@refs/heads/main"]
    )
    error_message = "Only the Foundation workflow on main may assume the foundation identity."
  }
  assert {
    condition     = google_service_account.github["foundation"].account_id == "mkc-github-foundation"
    error_message = "The foundation identity keeps its stable account ID."
  }
}
