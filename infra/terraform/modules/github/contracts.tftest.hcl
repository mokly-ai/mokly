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
  repository    = "mokly-ai/mokly"
}

run "contracts" {
  command = plan
  assert {
    condition     = strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository_id == '123456'") && strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository_owner_id == '987654'")
    error_message = "trusted_numeric_identity contract changed."
  }
  assert {
    condition     = strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository == 'mokly-ai/mokly'") && !strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "mokly-ai/mokly-cloud/")
    error_message = "The provider must trust the public Mokly repository and its workflow refs."
  }
  assert {
    condition     = strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "preview.yml@refs/heads/main") && strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "'mokly-ai/mokly/.github/workflows/foundation.yml@refs/heads/main'") && keys(google_service_account_iam_member.github) == ["mokly-ai/mokly/apply/deploy", "mokly-ai/mokly/deploy/deploy", "mokly-ai/mokly/deploy/preview", "mokly-ai/mokly/foundation/foundation", "mokly-ai/mokly/plan/ci", "mokly-ai/mokly/plan/deploy", "mokly-ai/mokly/plan/foundation", "mokly-ai/mokly/postmark/deploy"] && keys(google_service_account.github) == ["apply", "deploy", "foundation", "plan", "postmark"]
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
      ["principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/mokly-ai/mokly/.github/workflows/foundation.yml@refs/heads/main"]
    )
    error_message = "Only the Foundation workflow on main may assume the foundation identity."
  }
  assert {
    condition     = google_service_account.github["foundation"].account_id == "mkc-github-foundation"
    error_message = "The foundation identity keeps its stable account ID."
  }
}

run "cutover_trust" {
  command = apply
  variables {
    legacy_repository_id = "654321"
  }
  assert {
    condition = alltrue([
      strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository == 'mokly-ai/mokly' && assertion.repository_id == '123456'"),
      strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "assertion.repository == 'mokly-ai/mokly-cloud' && assertion.repository_id == '654321'"),
      length(google_service_account_iam_member.github) == 16,
      alltrue([for binding in google_service_account_iam_member.github :
        strcontains(google_iam_workload_identity_pool_provider.github.attribute_condition, "'${trimprefix(binding.member, "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/")}'")
      ])
    ])
    error_message = "Cutover must pair each repository ID with its own trusted main workflows."
  }
  assert {
    condition = alltrue([for binding in google_service_account_iam_member.github :
      endswith(binding.member, "/.github/workflows/foundation.yml@refs/heads/main")
      if binding.service_account_id == google_service_account.github["foundation"].name
    ])
    error_message = "Both repositories must keep the foundation identity limited to Foundation on main."
  }
}

run "invalid_legacy_identity" {
  command = plan
  variables {
    legacy_repository_id = "mokly-ai/mokly-cloud"
  }
  expect_failures = [var.legacy_repository_id]
}
