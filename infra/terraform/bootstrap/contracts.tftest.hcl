mock_provider "google" {}
variables {
  project      = "mokly-508518"
  region       = "us-central1"
  state_bucket = "mkc-test-state"
}
run "topology" {
  command = plan
  assert {
    condition     = !google_storage_bucket.state.force_destroy && google_storage_bucket.state.versioning[0].enabled && google_storage_bucket.state.uniform_bucket_level_access && google_storage_bucket.state.public_access_prevention == "enforced" && google_storage_bucket.state.soft_delete_policy[0].retention_duration_seconds == 604800
    error_message = "Remote state must preserve versioning, uniform/private access and seven-day soft delete."
  }
  assert {
    condition     = can(regex("lifecycle\\s*\\{\\s*prevent_destroy\\s*=\\s*true", file("${path.module}/main.tf")))
    error_message = "State lifecycle must forbid destroy (lifecycle is not a resource attribute)."
  }
}
